"""Video generation endpoint — creates async Agnes video task and polls status."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.crypto import decrypt
from app.db.session import get_db
from app.models.api_key import ApiKey, Provider
from app.models.generation import Generation, GenerationMode, GenerationStatus, GenerationType
from app.models.user import User
from app.schemas.generation import (
    GenerateVideoRequest,
    GenerationResponse,
    VideoCreateResponse,
)
from app.utils.cos import get_presigned_url, upload_video_from_url

router = APIRouter(prefix="/generate", tags=["generate"])

AGNES_VIDEO_URL = "https://apihub.agnes-ai.com/v1/videos"
AGNES_VIDEO_STATUS_URL = "https://apihub.agnes-ai.com/agnesapi"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lookup_agnes_key(user: User, db: Session) -> str:
    """Return the decrypted Agnes API key, or raise 400."""
    row = db.execute(
        select(ApiKey).where(
            ApiKey.user_id == user.id, ApiKey.provider == Provider.agnes
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Agnes API key configured. Please add it in Settings.",
        )
    return decrypt(row.encrypted_key, row.iv)


def _validate_num_frames(num_frames: int) -> None:
    """Ensure num_frames follows 8n+1 rule and is ≤ 441."""
    if num_frames > 441:
        raise HTTPException(status_code=400, detail="num_frames must be ≤ 441")
    if (num_frames - 1) % 8 != 0:
        raise HTTPException(
            status_code=400,
            detail="num_frames must follow the 8n+1 rule (e.g. 81, 121, 241, 441)",
        )


# ---------------------------------------------------------------------------
# POST /api/generate/video
# ---------------------------------------------------------------------------


@router.post("/video", response_model=VideoCreateResponse)
async def generate_video(
    body: GenerateVideoRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.mode not in ("text2vid", "img2vid"):
        raise HTTPException(status_code=400, detail="Invalid mode, expected text2vid or img2vid")
    if body.mode == "img2vid" and not body.image_url:
        raise HTTPException(status_code=400, detail="image_url is required for img2vid mode")

    _validate_num_frames(body.num_frames)

    api_key = _lookup_agnes_key(user, db)

    try:
        upstream_video_id = await _create_agnes_video_task(api_key, body)
    except HTTPException:
        raise
    except Exception as exc:
        record = Generation(
            user_id=user.id,
            provider=Provider.agnes,
            type=GenerationType.video,
            mode=GenerationMode(body.mode),
            prompt=body.prompt,
            size=f"{body.width}x{body.height}",
            status=GenerationStatus.failed,
            error=str(exc),
            width=body.width,
            height=body.height,
            num_frames=body.num_frames,
            frame_rate=body.frame_rate,
        )
        db.add(record)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create video task: {exc}",
        )

    record = Generation(
        user_id=user.id,
        provider=Provider.agnes,
        type=GenerationType.video,
        mode=GenerationMode(body.mode),
        prompt=body.prompt,
        size=f"{body.width}x{body.height}",
        status=GenerationStatus.queued,
        progress=0,
        upstream_video_id=upstream_video_id,
        width=body.width,
        height=body.height,
        num_frames=body.num_frames,
        frame_rate=body.frame_rate,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return VideoCreateResponse(id=record.id, status=record.status.value, progress=0)


async def _create_agnes_video_task(api_key: str, body: GenerateVideoRequest) -> str:
    """Call Agnes video API and return the video_id."""
    payload: dict = {
        "model": "agnes-video-v2.0",
        "prompt": body.prompt,
        "width": body.width,
        "height": body.height,
        "num_frames": body.num_frames,
        "frame_rate": body.frame_rate,
    }

    if body.mode == "img2vid" and body.image_url:
        if body.image_url:
            payload["image"] = body.image_url

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            AGNES_VIDEO_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code != 200:
        detail = f"Agnes video API error (HTTP {resp.status_code}): {resp.text[:300]}"
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    data = resp.json()
    video_id = data.get("video_id")
    if not video_id:
        raise RuntimeError("No video_id in Agnes response")
    return video_id

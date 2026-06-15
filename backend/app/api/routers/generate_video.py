"""Video generation endpoint — creates async Agnes video task and polls status."""

import json
import logging

logger = logging.getLogger("uvicorn")

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, lookup_api_key
from app.db.session import get_db
from app.models.api_key import Provider
from app.models.generation import Generation, GenerationMode, GenerationStatus, GenerationType
from app.models.user import User
from app.schemas.generation import (
    GenerateVideoRequest,
    VideoCreateResponse,
)

router = APIRouter(prefix="/generate", tags=["generate"])

AGNES_VIDEO_URL = "https://apihub.agnes-ai.com/v1/videos"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
    if body.mode not in ("text2vid", "img2vid", "multimg", "keyframes"):
        raise HTTPException(status_code=400, detail="Invalid mode, expected text2vid, img2vid, multimg, or keyframes")
    if body.mode in ("img2vid", "multimg", "keyframes") and not body.image_urls:
        raise HTTPException(status_code=400, detail="image_urls are required for img2vid, multimg, and keyframes modes")
    if body.mode == "img2vid" and len(body.image_urls) != 1:
        raise HTTPException(status_code=400, detail="img2vid mode requires exactly 1 image")
    if body.mode in ("multimg", "keyframes") and len(body.image_urls) < 2:
        raise HTTPException(status_code=400, detail=f"{body.mode} mode requires at least 2 images, got {len(body.image_urls)}")

    _validate_num_frames(body.num_frames)

    api_key = lookup_api_key(Provider.agnes, user, db)

    try:
        upstream_video_id = await _create_agnes_video_task(api_key, body)
    except HTTPException as exc:
        # Create a failed record so the user can see the error in history
        record = Generation(
            user_id=user.id,
            provider=Provider.agnes,
            type=GenerationType.video,
            mode=GenerationMode(body.mode),
            prompt=body.prompt,
            size=f"{body.width}x{body.height}",
            input_images=json.dumps(body.image_cos_keys) if body.image_cos_keys else None,
            status=GenerationStatus.failed,
            error=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            width=body.width,
            height=body.height,
            num_frames=body.num_frames,
            frame_rate=body.frame_rate,
        )
        db.add(record)
        db.commit()
        raise
    except httpx.TimeoutException as exc:
        logger.error(f"Agnes video task creation timed out: {type(exc).__name__}: {exc}")
        record = Generation(
            user_id=user.id,
            provider=Provider.agnes,
            type=GenerationType.video,
            mode=GenerationMode(body.mode),
            prompt=body.prompt,
            size=f"{body.width}x{body.height}",
            input_images=json.dumps(body.image_cos_keys) if body.image_cos_keys else None,
            status=GenerationStatus.failed,
            error=f"Upstream timeout: {exc}",
            width=body.width,
            height=body.height,
            num_frames=body.num_frames,
            frame_rate=body.frame_rate,
        )
        db.add(record)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Agnes video API timed out — the upstream server did not respond within 120 seconds. Please try again later.",
        )
    except Exception as exc:
        logger.error(f"Agnes video task creation failed: {type(exc).__name__}: {exc}")
        record = Generation(
            user_id=user.id,
            provider=Provider.agnes,
            type=GenerationType.video,
            mode=GenerationMode(body.mode),
            prompt=body.prompt,
            size=f"{body.width}x{body.height}",
            input_images=json.dumps(body.image_cos_keys) if body.image_cos_keys else None,
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
            detail=f"Failed to create video task ({type(exc).__name__}): {exc}",
        )

    record = Generation(
        user_id=user.id,
        provider=Provider.agnes,
        type=GenerationType.video,
        mode=GenerationMode(body.mode),
        prompt=body.prompt,
        size=f"{body.width}x{body.height}",
        input_images=json.dumps(body.image_cos_keys) if body.image_cos_keys else None,
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
    """Call Agnes video API and return the task_id."""
    payload: dict = {
        "model": "agnes-video-v2.0",
        "prompt": body.prompt,
        "width": body.width,
        "height": body.height,
        "num_frames": body.num_frames,
        "frame_rate": body.frame_rate,
    }

    if body.mode == "img2vid" and body.image_urls:
        payload["image"] = body.image_urls[0]
    elif body.mode == "multimg" and body.image_urls:
        payload.setdefault("extra_body", {})["image"] = body.image_urls
    elif body.mode == "keyframes" and body.image_urls:
        payload.setdefault("extra_body", {})["image"] = body.image_urls
        payload.setdefault("extra_body", {})["mode"] = "keyframes"

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0)) as client:
        logger.debug(f"=== VIDEO === mode={body.mode}")
        resp = await client.post(
            AGNES_VIDEO_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        logger.debug(f"=== VIDEO === upstream_status={resp.status_code}")

    if resp.status_code != 200:
        detail = f"Agnes video API error (HTTP {resp.status_code}): {resp.text[:300]}"
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    data = resp.json()
    task_id = data.get("id")
    if not task_id:
        raise RuntimeError(f"No id in Agnes response: {resp.text[:300]}")
    return task_id

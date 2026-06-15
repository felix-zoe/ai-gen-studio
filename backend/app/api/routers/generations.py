"""Generations history — list past generations & poll video status with presigned URLs."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.crypto import decrypt
from app.db.session import get_db
from app.models.api_key import ApiKey, Provider
from app.models.generation import Generation, GenerationStatus, GenerationType
from app.models.user import User
from app.schemas.generation import GenerationListResponse, GenerationResponse
from app.utils.cos import get_presigned_url, upload_video_from_url

router = APIRouter(prefix="/generations", tags=["generations"])

AGNES_VIDEO_STATUS_URL = "https://apihub.agnes-ai.com/v1/videos"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _lookup_agnes_key(user: User, db: Session) -> str:
    """Return the decrypted Agnes API key, or raise 404."""
    row = db.execute(
        select(ApiKey).where(
            ApiKey.user_id == user.id, ApiKey.provider == Provider.agnes
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Agnes API key configured.",
        )
    return decrypt(row.encrypted_key, row.iv)


def _build_response(row: Generation) -> GenerationResponse:
    """Build a GenerationResponse with presigned URLs from a DB row."""
    item = GenerationResponse.model_validate(row)
    if row.type == GenerationType.video:
        item.video_url = get_presigned_url(row.video_cos_key)
    else:
        item.image_url = get_presigned_url(row.cos_key)
    return item


# ---------------------------------------------------------------------------
# GET /api/generations  — list (supports type=image|video)
# ---------------------------------------------------------------------------


@router.get("", response_model=GenerationListResponse)
def list_generations(
    type_: str = Query("image", alias="type", description="Filter by type (image or video)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base = (
        select(Generation)
        .where(Generation.user_id == user.id, Generation.type == type_)
        .order_by(Generation.created_at.desc())
    )

    total = db.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar_one()

    rows = (
        db.execute(base.offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .all()
    )

    items = [_build_response(row) for row in rows]

    return GenerationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# DELETE /api/generations/{id}
# ---------------------------------------------------------------------------


@router.delete("/{generation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_generation(
    generation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.get(Generation, generation_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Generation not found")
    db.delete(row)
    db.commit()


# ---------------------------------------------------------------------------
# GET /api/generations/{id}  — single item with optional video status polling
# ---------------------------------------------------------------------------


@router.get("/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.get(Generation, generation_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Generation not found")

    # For unfinished video tasks, poll Agnes for status update
    if (
        row.type == GenerationType.video
        and row.status in (GenerationStatus.queued, GenerationStatus.in_progress)
        and row.upstream_video_id
    ):
        try:
            api_key = _lookup_agnes_key(user, db)
            await _poll_video_status(row, api_key, db)
        except HTTPException:
            raise
        except Exception:
            # Silently swallow poll errors — return current DB state
            pass

    return _build_response(row)


async def _poll_video_status(
    row: Generation, api_key: str, db: Session
) -> None:
    """Poll Agnes for the latest video task status and update the DB record."""
    poll_url = f"{AGNES_VIDEO_STATUS_URL}/{row.upstream_video_id}"
    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)) as client:
        resp = await client.get(
            poll_url,
            headers={"Authorization": f"Bearer {api_key}"},
        )

    if resp.status_code != 200:
        return  # Don't update — retry next poll

    data = resp.json()
    upstream_status = data.get("status", "")

    # Update progress
    progress = data.get("progress")
    if progress is not None:
        row.progress = int(progress)

    if upstream_status == "completed":
        # Agnes returns video_url in the completed response; fall back to remixed_from_video_id
        video_url = data.get("video_url") or data.get("remixed_from_video_id")
        if video_url:
            try:
                video_cos_key = await upload_video_from_url(video_url, row.user_id)
                row.video_cos_key = video_cos_key
            except Exception:
                # If download/upload fails, keep the upstream URL as fallback
                row.error = "Video download to storage failed"
        row.status = GenerationStatus.completed
        row.progress = 100
    elif upstream_status == "failed":
        row.status = GenerationStatus.failed
        error_obj = data.get("error")
        row.error = str(error_obj) if error_obj else "Video generation failed"
    elif upstream_status == "in_progress":
        row.status = GenerationStatus.in_progress
    else:
        # queued or unknown — keep queued
        row.status = GenerationStatus.queued

    db.commit()
    db.refresh(row)

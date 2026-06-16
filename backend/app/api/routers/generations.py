"""Generations history — list past generations & poll video status with presigned URLs."""

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, lookup_api_key
from app.db.session import get_db
from app.models.api_key import Provider
from app.models.generation import Generation, GenerationMode, GenerationStatus, GenerationType
from app.models.user import User
from app.schemas.generation import GenerationListResponse, GenerationResponse, BatchDeleteRequest
from app.utils.cos import async_get_presigned_url, upload_video_from_url, async_delete_object, async_download_object

logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/generations", tags=["generations"])

AGNES_VIDEO_STATUS_URL = "https://apihub.agnes-ai.com/v1/videos"

# Video tasks that haven't reached a terminal state within this window are
# considered stuck (upstream may have silently dropped the task).
_VIDEO_STALE_THRESHOLD = timedelta(hours=2)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _build_response(row: Generation) -> GenerationResponse:
    """Build a GenerationResponse with presigned URLs from a DB row."""
    item = GenerationResponse.model_validate(row)
    if row.type == GenerationType.video:
        item.video_url = await async_get_presigned_url(row.video_cos_key)
    else:
        item.image_url = await async_get_presigned_url(row.cos_key)

    # Thumbnail URL for image generations
    if row.thumbnail_cos_key:
        item.thumbnail_url = await async_get_presigned_url(row.thumbnail_cos_key)

    # Generate presigned URLs for reference/input images
    if row.input_images:
        try:
            cos_keys = json.loads(row.input_images)
            item.input_images = [
                await async_get_presigned_url(k) for k in cos_keys if k
            ]
        except (json.JSONDecodeError, TypeError):
            item.input_images = None

    return item


async def _cleanup_cos(row: Generation) -> None:
    """Delete all COS objects associated with a generation record (best-effort)."""
    keys_to_delete = []
    if row.cos_key:
        keys_to_delete.append(row.cos_key)
    if row.video_cos_key:
        keys_to_delete.append(row.video_cos_key)
    if row.input_images:
        try:
            input_keys = json.loads(row.input_images)
            keys_to_delete.extend([k for k in input_keys if k])
        except (json.JSONDecodeError, TypeError):
            pass

    for key in keys_to_delete:
        await async_delete_object(key)


# ---------------------------------------------------------------------------
# GET /api/generations  — list (supports type=image|video)
# ---------------------------------------------------------------------------


@router.get("", response_model=GenerationListResponse)
async def list_generations(
    type_: str = Query("image", alias="type", description="Filter by type (image or video)"),
    search: str = Query(None, description="Search by prompt keyword"),
    status: str = Query(None, description="Filter by status (queued, in_progress, completed, failed)"),
    mode: str = Query(None, description="Filter by mode (text2img, img2img, text2vid, img2vid, multimg, keyframes)"),
    date_from: str = Query(None, description="Filter from date (ISO format, e.g. 2026-06-01)"),
    date_to: str = Query(None, description="Filter to date (ISO format, e.g. 2026-06-15)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conditions = [Generation.user_id == user.id, Generation.type == type_]

    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append(Generation.prompt.ilike(f"%{escaped}%", escape="\\"))
    if status:
        try:
            conditions.append(Generation.status == GenerationStatus(status))
        except ValueError:
            pass  # ignore invalid status values
    if mode:
        try:
            conditions.append(Generation.mode == GenerationMode(mode))
        except ValueError:
            pass  # ignore invalid mode values
    if date_from:
        try:
            df = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            conditions.append(Generation.created_at >= df)
        except ValueError:
            pass
    if date_to:
        try:
            dto = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            # Include the end of the day
            dto = dto.replace(hour=23, minute=59, second=59)
            conditions.append(Generation.created_at <= dto)
        except ValueError:
            pass

    base = (
        select(Generation)
        .where(*conditions)
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

    items = [await _build_response(row) for row in rows]

    return GenerationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /api/generations/{id}/download
# ---------------------------------------------------------------------------


@router.get("/{generation_id}/download")
async def download_generation(
    generation_id: int,
    type: str = Query("image", pattern=r"^(image|video)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download the generated image or video via backend proxy (avoids CORS)."""
    row = db.get(Generation, generation_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Generation not found")

    cos_key = row.video_cos_key if type == "video" else row.cos_key
    if not cos_key:
        raise HTTPException(status_code=404, detail="文件不存在")

    result = await async_download_object(cos_key)
    if not result:
        raise HTTPException(status_code=502, detail="无法从存储下载文件")

    content, content_type = result
    # 从 cos_key 提取文件名
    filename = cos_key.rsplit("/", 1)[-1] if "/" in cos_key else "download"
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# DELETE /api/generations/{id}
# ---------------------------------------------------------------------------


@router.delete("/{generation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_generation(
    generation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.get(Generation, generation_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Generation not found")
    await _cleanup_cos(row)
    db.delete(row)
    db.commit()


# ---------------------------------------------------------------------------
# POST /api/generations/batch-delete
# ---------------------------------------------------------------------------


@router.post("/batch-delete", status_code=status.HTTP_200_OK)
async def batch_delete_generations(
    body: BatchDeleteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = 0
    not_found = 0
    for gid in body.ids:
        row = db.get(Generation, gid)
        if not row or row.user_id != user.id:
            not_found += 1
            continue
        await _cleanup_cos(row)
        db.delete(row)
        deleted += 1
    db.commit()
    return {"deleted": deleted, "not_found": not_found}


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
            api_key = lookup_api_key(Provider.agnes, user, db)
            await _poll_video_status(row, api_key, db)
        except HTTPException:
            raise
        except Exception:
            # Silently swallow poll errors — return current DB state
            pass

    return await _build_response(row)


async def _poll_video_status(
    row: Generation, api_key: str, db: Session
) -> None:
    """Poll Agnes for the latest video task status and update the DB record."""

    # ── Stale detection ──────────────────────────────────────────────────
    # If the task has been queued/in_progress for more than the threshold,
    # the upstream task is likely gone — mark as failed to avoid infinite polling.
    if row.created_at:
        created = row.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - created > _VIDEO_STALE_THRESHOLD:
            row.status = GenerationStatus.failed
            row.error = "Task timed out after 2 hours"
            db.commit()
            db.refresh(row)
            return

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
        # Guard against concurrent polls: re-read row to check if another
        # poll already downloaded and stored the video.
        db.refresh(row)
        if row.video_cos_key:
            return  # Already processed by another poll

        video_url = data.get("video_url")
        if not video_url:
            row.status = GenerationStatus.failed
            row.error = "Upstream returned no video URL"
        else:
            try:
                video_cos_key = await upload_video_from_url(video_url, row.user_id)
                row.video_cos_key = video_cos_key
                row.status = GenerationStatus.completed
                row.progress = 100
            except Exception as exc:
                row.status = GenerationStatus.failed
                row.error = f"Video download to storage failed: {exc}"
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

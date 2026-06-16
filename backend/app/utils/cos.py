"""Tencent Cloud COS utilities — upload & presigned URL."""

import asyncio
import mimetypes
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

import httpx
from qcloud_cos import CosConfig, CosS3Client

from app.core.config import settings


@lru_cache(maxsize=1)
def _get_client() -> CosS3Client:
    """Create a COS client from settings (cached singleton)."""
    config = CosConfig(
        Region=settings.COS_REGION,
        SecretId=settings.COS_SECRET_ID,
        SecretKey=settings.COS_SECRET_KEY,
    )
    return CosS3Client(config)


def _check_configured() -> None:
    """Raise RuntimeError if COS is not fully configured."""
    missing = [
        name
        for name in ("COS_SECRET_ID", "COS_SECRET_KEY", "COS_REGION", "COS_BUCKET")
        if not getattr(settings, name, None)
    ]
    if missing:
        raise RuntimeError(
            f"COS not configured: {', '.join(missing)} missing from .env"
        )


# ---------------------------------------------------------------------------
# Synchronous primitives
# ---------------------------------------------------------------------------


def upload_file(file_bytes: bytes, user_id: int, filename: str) -> str:
    """
    Upload raw bytes to COS.

    Returns the COS key (object path), which can be stored in DB and later
    turned into a presigned URL via ``get_presigned_url()``.

    Key format: ``uploads/{user_id}/{date}/{uuid}.{ext}``
    """
    _check_configured()
    client = _get_client()

    # Derive extension & content-type
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "png").lower()
    image_exts = ("png", "jpg", "jpeg", "webp", "gif")
    video_exts = ("mp4", "webm", "mov")
    if ext not in image_exts + video_exts:
        ext = "png"
    content_type, _ = mimetypes.guess_type(f"file.{ext}")
    if not content_type:
        content_type = f"image/{ext}" if ext in image_exts else f"video/{ext}"

    date_prefix = datetime.now(timezone.utc).strftime("%Y%m%d")

    key = f"aigenstudio/uploads/{user_id}/{date_prefix}/{uuid.uuid4().hex}.{ext}"

    client.put_object(
        Bucket=settings.COS_BUCKET,
        Body=file_bytes,
        Key=key,
        ContentType=content_type,
    )
    return key


def get_presigned_url(cos_key: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a presigned (temporary) download URL for a COS object.

    Returns ``None`` when *cos_key* is falsy (e.g. generation failed).
    """
    if not cos_key:
        return None
    try:
        _check_configured()
        client = _get_client()
        return client.get_presigned_url(
            Method="GET",
            Bucket=settings.COS_BUCKET,
            Key=cos_key,
            Expired=expires_in,
        )
    except Exception:
        return None


def delete_object(cos_key: str) -> bool:
    """
    Delete a COS object by its key.

    Returns True on success, False on failure (logs error silently).
    """
    if not cos_key:
        return False
    try:
        _check_configured()
        client = _get_client()
        client.delete_object(
            Bucket=settings.COS_BUCKET,
            Key=cos_key,
        )
        return True
    except Exception:
        # Silently swallow — COS cleanup is best-effort
        return False


def download_object(cos_key: str) -> Optional[tuple[bytes, str]]:
    """
    Download a COS object and return (bytes, content_type).

    Returns ``None`` when *cos_key* is falsy or on error.
    """
    if not cos_key:
        return None
    try:
        _check_configured()
        client = _get_client()
        resp = client.get_object(
            Bucket=settings.COS_BUCKET,
            Key=cos_key,
        )
        content_type = resp.get("Content-Type", "application/octet-stream")
        # Body is a streaming iterator — read all bytes
        body = resp["Body"].read()
        return body, content_type
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Async wrappers — run blocking COS SDK calls in a thread executor
# ---------------------------------------------------------------------------


async def async_upload_file(file_bytes: bytes, user_id: int, filename: str) -> str:
    """Async wrapper around :func:`upload_file` (runs in thread executor)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, upload_file, file_bytes, user_id, filename)


async def async_get_presigned_url(cos_key: str, expires_in: int = 3600) -> Optional[str]:
    """Async wrapper around :func:`get_presigned_url` (runs in thread executor)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_presigned_url, cos_key, expires_in)


async def async_delete_object(cos_key: str) -> bool:
    """Async wrapper around :func:`delete_object` (runs in thread executor)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, delete_object, cos_key)


async def async_download_object(cos_key: str) -> Optional[tuple[bytes, str]]:
    """Async wrapper around :func:`download_object` (runs in thread executor)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, download_object, cos_key)


# ---------------------------------------------------------------------------
# Download-then-upload helpers
# ---------------------------------------------------------------------------


async def upload_image_from_url(image_url: str, user_id: int) -> str:
    """
    Download an image from *image_url* and upload it to COS.

    Returns the COS key.
    """
    async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
        resp = await client.get(image_url)
        resp.raise_for_status()
        content = resp.content

    filename = image_url.rsplit("/", 1)[-1].split("?")[0] or "image.png"
    return await async_upload_file(content, user_id, filename)


async def upload_video_from_url(video_url: str, user_id: int) -> str:
    """
    Download a video from *video_url* and upload it to COS.

    Returns the COS key.
    """
    async with httpx.AsyncClient(follow_redirects=True, timeout=300) as client:
        resp = await client.get(video_url)
        resp.raise_for_status()
        content = resp.content

    filename = video_url.rsplit("/", 1)[-1].split("?")[0] or "video.mp4"
    return await async_upload_file(content, user_id, filename)

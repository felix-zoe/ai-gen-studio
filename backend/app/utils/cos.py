"""Tencent Cloud COS utilities — upload & presigned URL."""

import mimetypes
from datetime import datetime, timezone
from typing import Optional

from qcloud_cos import CosConfig, CosS3Client

from app.core.config import settings


def _get_client() -> CosS3Client:
    """Create a COS client from settings."""
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
    import uuid

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


async def upload_image_from_url(image_url: str, user_id: int) -> str:
    """
    Download an image from *image_url* and upload it to COS.

    Returns the COS key.
    """
    import httpx

    async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
        resp = await client.get(image_url)
    resp.raise_for_status()

    # Try to extract filename from URL
    filename = image_url.rsplit("/", 1)[-1].split("?")[0] or "image.png"
    return upload_file(resp.content, user_id, filename)


async def upload_video_from_url(video_url: str, user_id: int) -> str:
    """
    Download a video from *video_url* and upload it to COS.

    Returns the COS key.
    """
    import httpx

    async with httpx.AsyncClient(follow_redirects=True, timeout=300) as client:
        resp = await client.get(video_url)
    resp.raise_for_status()

    filename = video_url.rsplit("/", 1)[-1].split("?")[0] or "video.mp4"
    return upload_file(resp.content, user_id, filename)


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
"""Upload endpoint — user-uploaded reference images for img2img."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.utils.cos import get_presigned_url, upload_file

router = APIRouter(prefix="/upload", tags=["upload"])

# Max file size: 20 MB
_MAX_SIZE = 20 * 1024 * 1024
_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


@router.post("")
async def upload_image(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type and file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PNG, JPEG, WebP, GIF",
        )

    body = await file.read()
    if len(body) > _MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 20 MB)",
        )

    try:
        cos_key = upload_file(body, user.id, file.filename or "image.png")
        url = get_presigned_url(cos_key)
        return {"cos_key": cos_key, "url": url}
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

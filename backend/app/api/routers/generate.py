import json
import logging

logger = logging.getLogger("uvicorn")

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.crypto import decrypt
from app.db.session import get_db
from app.models.api_key import ApiKey, Provider
from app.models.generation import Generation, GenerationMode, GenerationStatus
from app.models.user import User
from app.schemas.generation import GenerateImageRequest, GenerationResponse
from app.utils.cos import get_presigned_url, upload_file, upload_image_from_url

router = APIRouter(prefix="/generate", tags=["generate"])

# ---------------------------------------------------------------------------
# Upstream API endpoints
# ---------------------------------------------------------------------------
SENSENOVA_URL = "https://token.sensenova.cn/v1/images/generations"
AGNES_URL = "https://apihub.agnes-ai.com/v1/images/generations"


def _lookup_api_key(provider: Provider, user: User, db: Session) -> str:
    """Return the decrypted API key for *provider*, or raise 400/404."""
    row = db.execute(
        select(ApiKey).where(
            ApiKey.user_id == user.id, ApiKey.provider == provider
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No API key configured for {provider.value}. Please add it in Settings.",
        )
    return decrypt(row.encrypted_key, row.iv)


# ---------------------------------------------------------------------------
# POST /api/generate/image
# ---------------------------------------------------------------------------


@router.post("/image", response_model=GenerationResponse)
async def generate_image(
    body: GenerateImageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.provider not in ("sensenova", "agnes"):
        raise HTTPException(status_code=400, detail="Invalid provider")
    if body.mode not in ("text2img", "img2img"):
        raise HTTPException(status_code=400, detail="Invalid mode")
    if body.mode == "img2img" and not body.image_urls:
        raise HTTPException(
            status_code=400, detail="image_urls are required for img2img mode"
        )
    if body.provider == "sensenova" and body.mode == "img2img":
        raise HTTPException(
            status_code=400,
            detail="SenseNova U1 Fast does not support image input (img2img). Use text2img mode or switch to Agnes.",
        )

    provider = Provider(body.provider)
    mode = GenerationMode(body.mode)
    api_key = _lookup_api_key(provider, user, db)

    try:
        if provider == Provider.sensenova:
            image_cos_key = await _call_sensenova(api_key, mode, body, user.id)
        else:
            image_cos_key = await _call_agnes(api_key, mode, body, user.id)
    except HTTPException:
        raise
    except Exception as exc:
        # Save failed record
        record = Generation(
            user_id=user.id,
            provider=provider,
            mode=mode,
            prompt=body.prompt,
            size=body.size,
            input_images=json.dumps(body.image_cos_keys) if body.image_cos_keys else None,
            status=GenerationStatus.failed,
            error=str(exc),
        )
        db.add(record)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream API error: {exc}",
        )

    # Save success record
    record = Generation(
        user_id=user.id,
        provider=provider,
        mode=mode,
        prompt=body.prompt,
        size=body.size,
        cos_key=image_cos_key,
        input_images=json.dumps(body.image_cos_keys) if body.image_cos_keys else None,
        status=GenerationStatus.completed,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Build response with presigned URL
    resp = GenerationResponse.model_validate(record)
    resp.image_url = get_presigned_url(image_cos_key)
    return resp


# ---------------------------------------------------------------------------
# Upstream callers
# ---------------------------------------------------------------------------


async def _call_sensenova(
    api_key: str, mode: GenerationMode, body: GenerateImageRequest, user_id: int
) -> str:
    """Call SenseNova API → download image → upload to COS → return COS key."""
    async with httpx.AsyncClient(timeout=120) as client:
        payload: dict = {
            "model": "sensenova-u1-fast",
            "prompt": body.prompt,
            "size": body.size,
            "n": 1,
        }
        if mode == GenerationMode.img2img and body.image_urls:
            payload["image"] = body.image_url

        resp = await client.post(
            SENSENOVA_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        _raise_on_bad_status(resp)

        data = resp.json()
        image_url = _extract_image_url(data)
        if not image_url:
            raise RuntimeError("No image URL in SenseNova response")

    return await upload_image_from_url(image_url, user_id)


async def _call_agnes(
    api_key: str, mode: GenerationMode, body: GenerateImageRequest, user_id: int
) -> str:
    """Call Agnes API → download image → upload to COS → return COS key."""
    extra_body: dict = {"response_format": "url"}
    if mode == GenerationMode.img2img and body.image_urls:
        extra_body["image"] = body.image_urls

    async with httpx.AsyncClient(timeout=120) as client:
        payload: dict = {
            "model": "agnes-image-2.1-flash",
            "prompt": body.prompt,
            "size": body.size,
            "extra_body": extra_body,
        }

        logger.warning(f"=== AGNES DEBUG === key prefix={api_key[:12]}... key_len={len(api_key)} size={body.size}")
        resp = await client.post(
            AGNES_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        logger.warning(f"=== AGNES DEBUG === upstream_status={resp.status_code} body={resp.text[:600]}")
        _raise_on_bad_status(resp)

        data = resp.json()
        image_url = _extract_image_url(data)
        if not image_url:
            raise RuntimeError("No image URL in Agnes response")

    return await upload_image_from_url(image_url, user_id)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _raise_on_bad_status(resp: httpx.Response) -> None:
    """Raise HTTPException if upstream returned an error."""
    if resp.status_code == 200:
        return
    detail = f"Upstream API error (HTTP {resp.status_code}): {resp.text[:500]}"
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


def _extract_image_url(data: dict) -> str | None:
    """Extract the first image URL from an OpenAI-compatible response.

    Expected shape::

        {"data": [{"url": "https://..."}, ...]}
    """
    try:
        return data["data"][0]["url"]
    except (KeyError, IndexError, TypeError):
        return None

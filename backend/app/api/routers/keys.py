import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.crypto import decrypt, encrypt
from app.db.session import get_db
from app.models.api_key import ApiKey, Provider
from app.models.user import User
from app.schemas.api_key import KeyStatus, KeysStatusResponse, KeyTestResponse, SaveKeyRequest

router = APIRouter(prefix="/keys", tags=["keys"])


# ── helpers ───────────────────────────────────────────────────────────────────

_MASK_SUFFIX_LEN = 4


def _mask(raw: str) -> str:
    """Return masked key like ``sk-****abcd``."""
    if len(raw) <= _MASK_SUFFIX_LEN + 3:
        return raw[:3] + "****" + raw[-min(_MASK_SUFFIX_LEN, len(raw)):]
    return raw[:3] + "****" + raw[-_MASK_SUFFIX_LEN:]


def _raise_on_unknown_provider(provider: str) -> Provider:
    try:
        return Provider(provider)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown provider: {provider}")


# ── GET /api/keys ─────────────────────────────────────────────────────────────

@router.get("")
def list_keys(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> KeysStatusResponse:
    rows = db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id)
    ).scalars().all()

    lookup: dict[str, ApiKey] = {row.provider.value: row for row in rows}

    keys = []
    for p in Provider:
        row = lookup.get(p.value)
        if row:
            plain = decrypt(row.encrypted_key, row.iv)
            keys.append(KeyStatus(provider=p.value, configured=True, masked_key=_mask(plain)))
        else:
            keys.append(KeyStatus(provider=p.value, configured=False, masked_key=None))

    return KeysStatusResponse(keys=keys)


# ── PUT /api/keys/{provider} ──────────────────────────────────────────────────

@router.put("/{provider}")
def save_key(
    provider: str,
    body: SaveKeyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prov = _raise_on_unknown_provider(provider)
    encrypted, iv = encrypt(body.key)

    existing = db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == prov)
    ).scalar_one_or_none()

    if existing:
        existing.encrypted_key = encrypted
        existing.iv = iv
    else:
        db.add(ApiKey(user_id=user.id, provider=prov, encrypted_key=encrypted, iv=iv))

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save API key. Please try again.",
        )
    return {"message": f"{provider} key saved"}


# ── DELETE /api/keys/{provider} ───────────────────────────────────────────────

@router.delete("/{provider}")
def delete_key(
    provider: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prov = _raise_on_unknown_provider(provider)
    existing = db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == prov)
    ).scalar_one_or_none()

    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")

    try:
        db.delete(existing)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete API key. Please try again.",
        )
    return {"message": f"{provider} key deleted"}


# ── POST /api/keys/{provider}/test ────────────────────────────────────────────

@router.post("/{provider}/test")
async def test_key(
    provider: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prov = _raise_on_unknown_provider(provider)
    row = db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.provider == prov)
    ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")

    raw_key = decrypt(row.encrypted_key, row.iv)

    try:
        if prov == Provider.sensenova:
            ok, msg = await _test_sensenova(raw_key)
        else:
            ok, msg = await _test_agnes(raw_key)

        return KeyTestResponse(ok=ok, message=msg)
    except httpx.HTTPError as e:
        return KeyTestResponse(ok=False, message=f"网络错误：{e}")


async def _test_sensenova(api_key: str) -> tuple[bool, str]:
    """Send a malformed request to validate key without generating an image."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://token.sensenova.cn/v1/images/generations",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            # 故意发送无效参数：认证通过后会快速返回 400/422，不会真正生成图片
            json={"model": "invalid-model", "prompt": "", "n": 0, "size": "invalid"},
        )
    return _interpret(resp)


async def _test_agnes(api_key: str) -> tuple[bool, str]:
    """Send a malformed request to validate key without generating an image."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://apihub.agnes-ai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            # 故意发送无效参数：认证通过后会快速返回 400/422，不会真正生成图片
            json={"model": "invalid-model", "prompt": ""},
        )
    return _interpret(resp)


def _interpret(resp: httpx.Response) -> tuple[bool, str]:
    if resp.status_code == 200:
        return True, "API Key 有效"
    if resp.status_code in (401, 403):
        return False, "API Key 无效或权限不足"
    if resp.status_code == 429:
        return True, "API Key 有效（当前请求过于频繁，请稍后再试）"
    # 400/422/404 等说明认证已通过，只是参数校验失败
    if resp.status_code in (400, 404, 422):
        return True, "API Key 有效"
    return False, f"未知响应（HTTP {resp.status_code}）"
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
    """Send a minimal request to validate key."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://token.sensenova.cn/v1/images/generations",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            # 使用有效 model，但省略 prompt 触发快速校验失败
            json={"model": "sensenova-u1-fast", "n": 0},
        )
    return _interpret(resp)


async def _test_agnes(api_key: str) -> tuple[bool, str]:
    """Send a minimal request to validate key."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://apihub.agnes-ai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            # 使用有效 model，但省略必要参数触发快速校验失败
            json={"model": "agnes-image-2.1-flash"},
        )
    return _interpret(resp)


def _interpret(resp: httpx.Response) -> tuple[bool, str]:
    """解读上游响应，判断 Key 是否有效。

    返回 (ok, message)：
    - ok=True: Key 确定有效
    - ok=False: Key 无效或无法验证
    """
    # 尝试解析响应体，用于更精细的判断
    try:
        data = resp.json()
    except Exception:
        data = {}

    # ── 确定有效 ──────────────────────────────────────────────────────────────
    if resp.status_code == 200:
        return True, "API Key 有效"
    if resp.status_code == 429:
        return True, "API Key 有效（当前请求过于频繁，请稍后再试）"
    # 400/422 说明认证已通过，只是参数校验失败
    if resp.status_code in (400, 422):
        return True, "API Key 有效"
    # 500 但错误信息是参数缺失（如 Agnes 的 "missing required argument"），说明认证已通过
    if resp.status_code == 500:
        err_msg = str(data.get("error", {}).get("message", "")).lower()
        if "missing" in err_msg or "required" in err_msg or "argument" in err_msg:
            return True, "API Key 有效"

    # ── 确定无效 ──────────────────────────────────────────────────────────────
    if resp.status_code in (401, 403):
        return False, "API Key 无效或权限不足"

    # ── 无法判断（服务问题）──────────────────────────────────────────────────
    if resp.status_code in (500, 502, 503, 504):
        return False, "上游服务暂时不可用，无法验证 Key，请稍后再试"

    # ── 未知情况 ──────────────────────────────────────────────────────────────
    return False, f"无法验证（HTTP {resp.status_code}）"
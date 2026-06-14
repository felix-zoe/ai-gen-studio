from pydantic import BaseModel


class SaveKeyRequest(BaseModel):
    key: str


class KeyStatus(BaseModel):
    provider: str
    configured: bool
    masked_key: str | None = None


class KeysStatusResponse(BaseModel):
    keys: list[KeyStatus]


class KeyTestResponse(BaseModel):
    ok: bool
    message: str
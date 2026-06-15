from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# ── Request ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str


# ── Response ──────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("created_at", mode="before")
    @classmethod
    def _ensure_utc_timezone(cls, v: object) -> object:
        """SQLite strips timezone info on read; stamp UTC so JSON includes '+00:00'."""
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v
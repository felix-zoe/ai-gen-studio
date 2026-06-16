"""Generation schemas — request / response for image & video generation."""

import json
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Image request ──────────────────────────────────────────────────────────────

class GenerateImageRequest(BaseModel):
    provider: str = Field(..., description="sensenova or agnes")
    mode: str = Field(..., description="text2img or img2img")
    prompt: str = Field(..., min_length=1, max_length=4000)
    size: str = Field(default="1024x1024", pattern=r"^\d+x\d+$")
    image_urls: Optional[list[str]] = Field(None, description="Reference image URLs (required for img2img, Agnes only)")
    image_cos_keys: Optional[list[str]] = Field(None, description="COS keys of uploaded reference images (for history storage)")


# ── Video request ──────────────────────────────────────────────────────────────

class GenerateVideoRequest(BaseModel):
    provider: str = Field("agnes", description="agnes only for now")
    mode: str = Field(..., description="text2vid, img2vid, multimg, or keyframes")
    prompt: str = Field(..., min_length=1, max_length=4000)
    image_urls: Optional[list[str]] = Field(None, description="Image URLs (required for img2vid/multimg/keyframes)")
    image_cos_keys: Optional[list[str]] = Field(None, description="COS keys of uploaded reference images (for history storage)")
    width: int = Field(1152, ge=256, le=1920)
    height: int = Field(768, ge=256, le=1920)
    num_frames: int = Field(121, ge=9, le=441)
    frame_rate: int = Field(24, ge=1, le=60)


# ── Response ───────────────────────────────────────────────────────────────────

class GenerationResponse(BaseModel):
    id: int
    provider: str
    type: str = "image"
    mode: str
    prompt: str
    size: str
    image_url: Optional[str] = None  # presigned URL
    video_url: Optional[str] = None  # presigned URL (video only)
    thumbnail_url: Optional[str] = None  # presigned URL for thumbnail (image only)
    input_images: Optional[list[str]] = None  # presigned URLs for reference/input images
    progress: Optional[int] = None
    status: str
    error: Optional[str] = None
    created_at: datetime
    width: Optional[int] = None
    height: Optional[int] = None
    num_frames: Optional[int] = None
    frame_rate: Optional[float] = None

    model_config = {"from_attributes": True}

    @field_validator("input_images", mode="before")
    @classmethod
    def _deserialize_input_images(cls, v: object) -> list[str] | None:
        """DB stores input_images as a JSON text string; decode it to a list."""
        if v is None or isinstance(v, list):
            return v  # type: ignore[return-value]
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else None
            except (json.JSONDecodeError, TypeError):
                return None
        return None

    @field_validator("created_at", mode="before")
    @classmethod
    def _ensure_utc_timezone(cls, v: object) -> object:
        """SQLite strips timezone info on read; stamp UTC so JSON includes '+00:00'.

        Without this, the serialized datetime has no timezone suffix and
        JavaScript's Date() treats it as local time, causing the frontend's
        stale-timeout check to misfire (e.g. off by 16 h for UTC+8 users).
        """
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class GenerationListResponse(BaseModel):
    items: list[GenerationResponse]
    total: int
    page: int
    page_size: int


class VideoCreateResponse(BaseModel):
    """Immediate response after creating a video task."""
    id: int
    status: str
    progress: int = 0


class BatchDeleteRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=100, description="List of generation IDs to delete")

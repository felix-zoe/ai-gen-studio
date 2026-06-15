"""Generation schemas — request / response for image & video generation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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

"""Generation model — tracks each image/video generation request & result."""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.api_key import Provider


class GenerationType(str, enum.Enum):
    image = "image"
    video = "video"


class GenerationMode(str, enum.Enum):
    text2img = "text2img"
    img2img = "img2img"
    text2vid = "text2vid"
    img2vid = "img2vid"


class GenerationStatus(str, enum.Enum):
    queued = "queued"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[Provider] = mapped_column(
        Enum(Provider, create_constraint=False, length=32), nullable=False
    )
    type: Mapped[GenerationType] = mapped_column(
        Enum(GenerationType), nullable=False, default=GenerationType.image
    )
    mode: Mapped[GenerationMode] = mapped_column(
        Enum(GenerationMode), nullable=False
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    size: Mapped[str] = mapped_column(String(32), nullable=False)
    cos_key: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Video-specific fields
    upstream_video_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True
    )
    progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_cos_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    num_frames: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frame_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[GenerationStatus] = mapped_column(
        Enum(GenerationStatus), nullable=False, default=GenerationStatus.completed
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationship
    user = relationship("User", back_populates="generations")
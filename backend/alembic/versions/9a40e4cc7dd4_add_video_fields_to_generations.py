"""add_video_fields_to_generations

Revision ID: 9a40e4cc7dd4
Revises: c2673273c6f1
Create Date: 2026-06-14 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a40e4cc7dd4"
down_revision: Union[str, None] = "c2673273c6f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite doesn't support ALTER TABLE ADD COLUMN with Enum natively,
    # but we can add nullable columns using batch mode.
    with op.batch_alter_table("generations", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "type",
                sa.Enum("image", "video", name="generationtype"),
                nullable=False,
                server_default="image",
            )
        )
        batch_op.add_column(
            sa.Column("upstream_video_id", sa.String(length=128), nullable=True)
        )
        batch_op.add_column(sa.Column("progress", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("video_cos_key", sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column("width", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("height", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("num_frames", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("frame_rate", sa.Float(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_generations_upstream_video_id"),
            ["upstream_video_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("generations", schema=None) as batch_op:
        batch_op.drop_index("ix_generations_upstream_video_id")
        batch_op.drop_column("frame_rate")
        batch_op.drop_column("num_frames")
        batch_op.drop_column("height")
        batch_op.drop_column("width")
        batch_op.drop_column("video_cos_key")
        batch_op.drop_column("progress")
        batch_op.drop_column("upstream_video_id")
        batch_op.drop_column("type")
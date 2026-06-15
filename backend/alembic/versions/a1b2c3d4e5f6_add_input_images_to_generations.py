"""add_input_images_to_generations

Revision ID: a1b2c3d4e5f6
Revises: 9a40e4cc7dd4
Create Date: 2026-06-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "9a40e4cc7dd4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility
    with op.batch_alter_table("generations", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("input_images", sa.Text(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("generations", schema=None) as batch_op:
        batch_op.drop_column("input_images")

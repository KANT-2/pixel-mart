"""add map avatar opt in

Revision ID: 7e1f3b9c2d45
Revises: 5c2e8d41a7b3
Create Date: 2026-10-09 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7e1f3b9c2d45"
down_revision: str | None = "5c2e8d41a7b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("map_avatar_opt_in", sa.Boolean(), server_default=sa.text("false"), nullable=False)
    )


def downgrade() -> None:
    op.drop_column("users", "map_avatar_opt_in")

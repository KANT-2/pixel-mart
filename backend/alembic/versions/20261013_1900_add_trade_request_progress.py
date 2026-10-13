"""add trade request progress (received checks, completed status)

Revision ID: 3c1d9a7e5b20
Revises: f351736c5a2c
Create Date: 2026-10-13 19:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3c1d9a7e5b20"
down_revision: str | None = "f351736c5a2c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("trade_requests", sa.Column("owner_received_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("trade_requests", sa.Column("requester_received_at", sa.DateTime(timezone=True), nullable=True))
    op.drop_constraint("status", "trade_requests", type_="check")
    op.create_check_constraint(
        "status",
        "trade_requests",
        "status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')",
    )


def downgrade() -> None:
    op.execute("UPDATE trade_requests SET status = 'accepted' WHERE status = 'completed'")
    op.drop_constraint("status", "trade_requests", type_="check")
    op.create_check_constraint("status", "trade_requests", "status IN ('pending', 'accepted', 'declined', 'cancelled')")
    op.drop_column("trade_requests", "requester_received_at")
    op.drop_column("trade_requests", "owner_received_at")

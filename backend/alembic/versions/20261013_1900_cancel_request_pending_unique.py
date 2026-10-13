"""cancel request: one pending request per order

Revision ID: 3c9e1d2a7b41
Revises: f351736c5a2c
Create Date: 2026-10-13 19:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3c9e1d2a7b41"
down_revision: str | None = "f351736c5a2c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 이미 대기 신청이 둘 이상인 주문은 가장 최근 것만 남기고 거절 처리 (인덱스를 만들 수 있게)
    op.execute(
        """
        UPDATE cancel_requests SET status = 'rejected'
        WHERE status = 'requested' AND id NOT IN (
            SELECT MAX(id) FROM cancel_requests WHERE status = 'requested' GROUP BY order_id
        )
        """
    )
    op.create_index(
        "uq_cancel_requests_pending_order",
        "cancel_requests",
        ["order_id"],
        unique=True,
        postgresql_where=sa.text("status = 'requested'"),
    )


def downgrade() -> None:
    op.drop_index("uq_cancel_requests_pending_order", table_name="cancel_requests")

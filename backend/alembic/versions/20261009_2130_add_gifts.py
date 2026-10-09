"""add gifts

Revision ID: 9a4c6e1d8b27
Revises: 7e1f3b9c2d45
Create Date: 2026-10-09 21:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9a4c6e1d8b27"
down_revision: str | None = "7e1f3b9c2d45"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gifts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("trade_post_id", sa.Integer(), nullable=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="pending", nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity BETWEEN 1 AND 9", name=op.f("ck_gifts_quantity")),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'declined')", name=op.f("ck_gifts_status")),
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], name=op.f("fk_gifts_order_id_orders"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_gifts_product_id_products")),
        sa.ForeignKeyConstraint(
            ["recipient_id"], ["users.id"], name=op.f("fk_gifts_recipient_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], name=op.f("fk_gifts_sender_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["trade_post_id"], ["trade_posts.id"], name=op.f("fk_gifts_trade_post_id_trade_posts"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gifts")),
    )
    op.create_index(op.f("ix_gifts_recipient_id"), "gifts", ["recipient_id"], unique=False)
    op.create_index(op.f("ix_gifts_sender_id"), "gifts", ["sender_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_gifts_sender_id"), table_name="gifts")
    op.drop_index(op.f("ix_gifts_recipient_id"), table_name="gifts")
    op.drop_table("gifts")

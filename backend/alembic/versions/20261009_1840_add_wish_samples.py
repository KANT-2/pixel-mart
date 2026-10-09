"""add wish samples

Revision ID: 5c2e8d41a7b3
Revises: 1b4619a94292
Create Date: 2026-10-09 18:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5c2e8d41a7b3"
down_revision: str | None = "1b4619a94292"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "wish_samples",
        sa.Column("region_code", sa.String(length=12), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.CheckConstraint("count >= 0", name=op.f("ck_wish_samples_count")),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], name=op.f("fk_wish_samples_product_id_products"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["region_code"], ["regions.code"], name=op.f("fk_wish_samples_region_code_regions"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("region_code", "product_id", name=op.f("pk_wish_samples")),
    )


def downgrade() -> None:
    op.drop_table("wish_samples")

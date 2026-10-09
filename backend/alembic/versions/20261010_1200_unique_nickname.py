"""unique nickname (case-insensitive)

Revision ID: c4e6a8b0d2f3
Revises: b3d5f7a9c1e2
Create Date: 2026-10-10 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c4e6a8b0d2f3"
down_revision: str | None = "b3d5f7a9c1e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 이미 겹친 닉네임은 먼저 가입한 사람만 그대로 두고 나머지는 '#id'를 붙인다
    op.execute(
        """
        UPDATE users u SET nickname = left(u.nickname, 30 - length('#' || u.id)) || '#' || u.id
        FROM (
            SELECT id, row_number() OVER (PARTITION BY lower(nickname) ORDER BY id) AS n FROM users
        ) d
        WHERE u.id = d.id AND d.n > 1
        """
    )
    op.create_index("uq_users_nickname_lower", "users", [sa.text("lower(nickname)")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_nickname_lower", table_name="users")

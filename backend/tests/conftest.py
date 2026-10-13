"""테스트는 개발·시연 DB가 아니라 별도 테스트 DB를 쓴다 — 주문 삭제·가격 변경 같은 테스트가 시연 데이터를 바꾸지 않게.
TEST_DATABASE_URL이 있으면 그 DB, 없으면 DATABASE_URL의 DB 이름 뒤에 _test를 붙인 DB (docs/SETUP.md 참고)"""

import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core import config


def _test_database_url() -> str:
    if url := os.environ.get("TEST_DATABASE_URL"):
        return url
    dev = make_url(config.settings.database_url)
    return dev.set(database=f"{dev.database}_test").render_as_string(hide_password=False)


# 엔진은 app을 불러올 때 만들어지므로, 그 전에 테스트 DB로 바꿔 둔다
config.settings.database_url = _test_database_url()

from app.core.db import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def require_db():
    """테스트 DB가 없거나 시드 전이면 건너뛴다"""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM products LIMIT 1"))
    except Exception:
        pytest.skip("테스트 DB가 없거나 시드 전입니다 (docs/SETUP.md의 '백엔드 테스트 DB' 참고)")

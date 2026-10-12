"""덕력지도 샘플 캐릭터 — DB 없이 확인"""

import base64

from app.services.sample_avatars import SPRITES, sample_avatars, sample_pool


def test_sprites_are_16x16():
    for name, rows in SPRITES.items():
        assert len(rows) == 16 and all(len(row) == 16 for row in rows), name


def test_pool_is_varied_small_pngs():
    pool = sample_pool()
    assert len(pool) >= 40 and len(set(pool)) == len(pool)
    for url in pool:
        png = base64.b64decode(url.removeprefix("data:image/png;base64,"))
        assert png.startswith(b"\x89PNG") and len(png) < 2_000


def test_same_key_same_crowd():
    assert sample_avatars("11:None", 30) == sample_avatars("11:None", 30)
    assert sample_avatars("11:None", 30) != sample_avatars("28:None", 30)
    crowd = sample_avatars("11:None", 120)  # 풀보다 많으면 반복
    assert len(crowd) == 120 and len(set(crowd[: len(sample_pool())])) == len(sample_pool())

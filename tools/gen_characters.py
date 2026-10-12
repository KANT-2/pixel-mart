"""PIXEL LOCAL 화면 아이콘용 캐릭터 PNG 생성기 — 덕력지도 샘플 캐릭터(backend/app/services/sample_avatars.py)와 같은 도트.

취향 칩·안내 카드 아이콘으로 쓴다. 도트 모양·색을 바꾸면 다시 실행: python tools/gen_characters.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.services.sample_avatars import named_pngs

OUT = ROOT / "public" / "images" / "characters"

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, png in named_pngs().items():
        (OUT / f"{name}.png").write_bytes(png)
    print(f"{len(named_pngs())}개 저장: {OUT}")

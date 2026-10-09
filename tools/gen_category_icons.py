"""PIXEL MART 카테고리 아이콘(SVG) 생성기 — 메인 카테고리 타일용 16×16 픽셀 스프라이트.

문자 하나가 한 픽셀입니다. 실행: python tools/gen_category_icons.py → public/images/category-*.svg
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "images"

PAL = {
    "K": "#14102a",  # 외곽선
    "W": "#ffffff", "L": "#e6e2ff", "S": "#a7a3c2", "s": "#6e6a8f",
    "G": "#b6ff5c", "g": "#5fae2a",
    "V": "#7b5cff", "v": "#4b35b8", "P": "#a78bff",
    "Y": "#ffd54a", "O": "#c98a14",
    "R": "#ff7a96", "r": "#c23a5c",
    "T": "#6ef2d6", "t": "#2f9e8f",
    "B": "#b57a3c", "b": "#6b4220",
}

ICONS = {
    # 키캡 — 윗면(밝음)·옆면(그림자), 가운데 라임 글자
    "keycap": [
        "................",
        "................",
        "...KKKKKKKKKK...",
        "..KLLLLLLLLLLK..",
        "..KLWWWWWWWWLK..",
        "..KLWWWGGWWWLK..",
        "..KLWWGWWGWWLK..",
        "..KLWWGGGGWWLK..",
        "..KLWWGWWGWWLK..",
        "..KLWWWWWWWWLK..",
        "..KSLLLLLLLLSK..",
        ".KSSSSSSSSSSSSK.",
        ".KssssssssssssK.",
        "..KKKKKKKKKKKK..",
        "................",
        "................",
    ],
    # 데스크매트 — 넓은 매트 위 마우스
    "deskmat": [
        "................",
        "................",
        "................",
        "................",
        "KKKKKKKKKKKKKKKK",
        "KVVVVVVVVVVVVVVK",
        "KVPVVVVVVVVKKKVK",
        "KVVVVVVPVVKWLLKK",
        "KVVVVVVVVVKLLSKK",
        "KVVPVVVVVVKLSSKK",
        "KVVVVVVVVVVKKKVK",
        "KvvvvvvvvvvvvvvK",
        "KKKKKKKKKKKKKKKK",
        "................",
        "................",
        "................",
    ],
    # 데스크 소품 — 스탠드 조명
    "desk": [
        "................",
        "......KKKKK.....",
        ".....KYYYYYK....",
        "....KYYYYYYYK...",
        "....KKKKKKKKK...",
        ".......YYY......",
        "......KsK.......",
        ".....KsK........",
        "....KsK.........",
        "....KsK.........",
        ".....KsK........",
        "......KsK.......",
        "....KKKKKKK.....",
        "...KsssssssK....",
        "...KKKKKKKKK....",
        "................",
    ],
    # 굿즈 — 고리 달린 아크릴 키링(슬라임)
    "goods": [
        "......KKK.......",
        ".....K...K......",
        ".....K...K......",
        "......KKK.......",
        ".......K........",
        "....KKKKKKK.....",
        "...KGGGGGGGK....",
        "..KGGLGGGGGGK...",
        "..KGGGGGGGGGK...",
        "..KGKGGGGKGGK...",
        "..KGKGGGGKGGK...",
        "..KGRGGKGGRGK...",
        "..KGGGGGGGGGK...",
        "...KgggggggK....",
        "....KKKKKKK.....",
        "................",
    ],
    # 리빙 — 김이 나는 머그컵
    "living": [
        "................",
        ".....S...S......",
        "......S...S.....",
        ".....S...S......",
        "................",
        "...KKKKKKKKK....",
        "...KTTTTTTTKKK..",
        "...KTWTTTTTK.K..",
        "...KTWTTTTTK.K..",
        "...KTTTTTTTK.K..",
        "...KTTTTTTTKKK..",
        "...KtttttttK....",
        "....KKKKKKK.....",
        "..KKKKKKKKKKK...",
        "................",
        "................",
    ],
    # 테크 액세서리 — 헤드폰
    "tech": [
        "................",
        ".....KKKKKK.....",
        "...KKssssssKK...",
        "..KsK......KsK..",
        "..KK........KK..",
        ".KsK........KsK.",
        ".KsK........KsK.",
        ".KKKKK....KKKKK.",
        ".KVVVK....KVVVK.",
        ".KVPVK....KVPVK.",
        ".KVVVK....KVVVK.",
        ".KvvvK....KvvvK.",
        ".KKKKK....KKKKK.",
        "................",
        "................",
        "................",
    ],
}


def svg(rows: list[str]) -> str:
    rects = [f'<rect x="{x}" y="{y}" width="1" height="1" fill="{PAL[c]}"/>'
             for y, row in enumerate(rows) for x, c in enumerate(row) if c in PAL]
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">{"".join(rects)}</svg>'


if __name__ == "__main__":
    for name, rows in ICONS.items():
        assert len(rows) == 16 and all(len(r) == 16 for r in rows), name
        (OUT / f"category-{name}.svg").write_text(svg(rows), encoding="utf-8")
        print("wrote", f"category-{name}.svg")

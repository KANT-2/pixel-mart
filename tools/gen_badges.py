"""활동 뱃지 픽셀 아이콘 생성기 — 16×16 도트 PNG (표준 라이브러리만 사용)

뱃지 목록은 backend/app/services/badges.py 와 같은 코드 이름을 쓴다.
도트를 바꾸면 다시 실행: python tools/gen_badges.py  (미리보기: python tools/gen_badges.py --sheet 저장경로.png)
"""

import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "images" / "badges"
SIZE = 16

K = "#14102a"  # 외곽선
W = "#ffffff"
BRONZE, SILVER, GOLD = "#d0894a", "#c9d3e6", "#ffd54a"


def shade(color: str, factor: float) -> str:
    r, g, b = (int(color[i : i + 2], 16) for i in (1, 3, 5))
    if factor <= 1:
        r, g, b = (int(v * factor) for v in (r, g, b))
    else:
        r, g, b = (int(v + (255 - v) * (factor - 1)) for v in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


def body(color: str) -> dict[str, str]:
    """B 몸통 · H 밝은 면 · b 그림자 · K 외곽선 · W 흰색"""
    return {"K": K, "W": W, "B": color, "H": shade(color, 1.45), "b": shade(color, 0.7)}


GAMEPAD = [
    "...KKKKKKKKKK...",
    "..KBBBBBBBBBBK..",
    ".KBBWBBBBBBBRBK.",
    ".KBWWWBBBBBRBRK.",
    ".KBBWBBBBBBBRBK.",
    ".KBBBBBBBBBBBBK.",
    ".KBBBBKKKKBBBBK.",
    ".KBBBK....KBBBK.",
    "..KKK......KKK..",
]
PIN = [
    "......KKKK......",
    ".....KBBBBK.....",
    "....KBBWWBBK....",
    "....KBWWWWBK....",
    "....KBBWWBBK....",
    ".....KBBBBK.....",
    "......KBBK......",
    ".......KK.......",
    "...GGGGKKGGGG...",
    "..GgGGGGGGGGgG..",
    "...GGGGGGGGGG...",
]
SLIME = [
    "......KKKK......",
    "....KKHHBBKK....",
    "...KBHHBBBBBK...",
    "..KBBBBBBBBBBK..",
    "..KBBKBBBBKBBK..",
    "..KBBKBBBBKBBK..",
    ".KBPBBBBBBBBPBK.",
    ".KBBBBBKKBBBBBK.",
    ".KbBBBBBBBBBBbK.",
    "..KKKKKKKKKKKK..",
]
CART = [
    "bbb.............",
    "..b.............",
    "..KKKKKKKKKKKKK.",
    "..KBBBBBBBBBBBK.",
    "..KBHBHBHBHBHBK.",
    "...KBBBBBBBBBK..",
    "...KBHBHBHBHBK..",
    "....KBBBBBBBK...",
    "....bbbbbbbbb...",
    "....b.......b...",
    "...bbb.....bbb..",
    "...bWb.....bWb..",
    "...bbb.....bbb..",
]
LETTER = [
    ".KKKKKKKKKKKKKK.",
    ".KbWWWWWWWWWWbK.",
    ".KWbWWWWWWWWbWK.",
    ".KWWbWWWWWWbWWK.",
    ".KWWWbRRWRRbWWK.",
    ".KWWWWRRRRRWWWK.",
    ".KWWWWWRRRWWWWK.",
    ".KWWWWWWRWWWWWK.",
    ".KWWWWWWWWWWWWK.",
    ".KKKKKKKKKKKKKK.",
]
SWAP = [
    "........B.......",
    "........BB......",
    "..HHHHHHHHH.....",
    "..BBBBBBBBBB....",
    "..bbbbbbbbb.....",
    "........bb......",
    "........b.......",
    "................",
    ".......G........",
    "......GG........",
    ".....gggggggggg.",
    "....GGGGGGGGGGG.",
    ".....GGGGGGGGGG.",
    "......GG........",
    ".......G........",
]
BUBBLE = [
    "..KKKKKKKKKKKK..",
    ".KWWWWWWWWWWWWK.",
    ".KWWWWWYWWWWWWK.",
    ".KWWWWYYYWWWWWK.",
    ".KWWYYYYYYYWWWK.",
    ".KWWWYYYYYWWWWK.",
    ".KWWWYYWYYWWWWK.",
    ".KWWWWWWWWWWWWK.",
    "..KKKKWKKKKKKK..",
    ".....KWK........",
    "....KK..........",
]
BACKPACK = [
    ".....KKKKKK.....",
    "....KK....KK....",
    "...KKKKKKKKKK...",
    "..KBBBBBBBBBBK..",
    "..KBHBBBBBBBBK..",
    "..KBBBBBBBBBBK..",
    "..KBKKKKKKKKBK..",
    "..KBKbbbbbbKBK..",
    "..KBKbbYYbbKBK..",
    "..KBKbbbbbbKBK..",
    "..KBKKKKKKKKBK..",
    "..KbbbbbbbbbbK..",
    "...KKKKKKKKKK...",
]
GIFT = [
    "....KK...KK.....",
    "...KYYK.KYYK....",
    "....KYYKYYK.....",
    ".KKKKKKKKKKKKKK.",
    ".KBBBBBYYBBBBBK.",
    ".KBBBBBYYBBBBBK.",
    ".KKKKKKKKKKKKKK.",
    "..KBBBBYYBBBBK..",
    "..KBHBBYYBBBBK..",
    "..KBBBBYYBBBBK..",
    "..KbbbbYYbbbbK..",
    "..KKKKKKKKKKKK..",
]
STAR = [
    ".......KK.......",
    "......KBBK......",
    "......KBBK......",
    ".....KBBBBK.....",
    "KKKKKKBBBBKKKKKK",
    "KBBBBBBBBBBBBBBK",
    ".KBBBBKBBKBBBBK.",
    "..KBBBKBBKBBBK..",
    "...KBBBBBBBBK...",
    "...KBPBBBBPBK...",
    "..KBBBBKKBBBBK..",
    "..KBBBK..KBBBK..",
    ".KBBK......KBBK.",
    ".KKK........KKK.",
]
GEM = [
    "....KKKKKKKK....",
    "...KWHBHHBHBK...",
    "..KHWBHHHHBHBK..",
    ".KKKKKKKKKKKKKK.",
    ".KBHBBBHHBBBHBK.",
    "..KBHBBHHBBHBK..",
    "...KBHBHHBHBK...",
    "....KBHBBHBK....",
    ".....KBHHBK.....",
    "......KBBK......",
    ".......KK.......",
]
HOUSE = [
    ".......KK.......",
    "......KRRK......",
    ".....KRRRRK.....",
    "....KRRHRRRK....",
    "...KRRHRRRRRK...",
    "..KRRRRRRRRRRK..",
    ".KKKKKKKKKKKKKK.",
    "..KWWWWWWWWWWK..",
    "..KWYYWWWWddWK..",
    "..KWYYWWWWddWK..",
    "..KWWWWWWWddWK..",
    "..KWWWWWWWddWK..",
    "..KKKKKKKKKKKK..",
]
TROPHY = [
    "..KKKKKKKKKKKK..",
    "KKKBHBBBBBBBBKKK",
    "KBKBHBBBBBBBbKBK",
    "KBKBHBBBBBBBbKBK",
    ".KKBHBBBBBBBbKK.",
    "...KBBBBBBBbK...",
    "....KBBBBBbK....",
    ".....KKBbKK.....",
    "......KBbK......",
    ".....KBBBbK.....",
    "....KKKKKKKK....",
]
COIN = [
    ".....KKKKKK.....",
    "...KKHHBBBBKK...",
    "..KHHBBBBBBBbK..",
    ".KHBBBBbBBBBBbK.",
    ".KHBBBBbBBBBBbK.",
    ".KBBBbbbbbBBBbK.",
    ".KBBBBbbbBBBBbK.",
    ".KBBBBbBbBBBBbK.",
    ".KBBBBBBBBBBBbK.",
    "..KBBBBBBBBBbK..",
    "...KKbbbbbbKK...",
    ".....KKKKKK.....",
]
CROWN = [
    ".K.....KK.....K.",
    "KBK...KBBK...KBK",
    "KBBK.KBBBBK.KBBK",
    "KBBBKBBBBBBKBBBK",
    "KBBBBBBBBBBBBBBK",
    "KBBRBBBGGBBBRBBK",
    "KBBBBBBBBBBBBBBK",
    "KHHHHHHHHHHHHHHK",
    "KbbbbbbbbbbbbbbK",
    "KKKKKKKKKKKKKKKK",
]
PIPS = {1: ".......PP.......", 2: ".....PP..PP.....", 3: "...PP..PP..PP..."}


def with_pips(rows: list[str], tier: int) -> list[str]:
    """단계 뱃지(Ⅰ·Ⅱ·Ⅲ)는 아래에 점 개수로 단계를 보여 준다"""
    return [*rows, "." * SIZE, PIPS[tier]]


VIOLET, PINK, MINT, BLUE, RED, YELLOW, GREEN = "#a78bff", "#ff7ab6", "#6ef2d6", "#5c7cff", "#ff4d6d", "#ffd54a", "#7ddc4f"
TIER_COLOR = {1: BRONZE, 2: SILVER, 3: GOLD}

BADGE_SPRITES: dict[str, tuple[list[str], dict[str, str]]] = {
    "new_player": (GAMEPAD, body(VIOLET) | {"R": RED}),
    "local": (PIN, body(PINK) | {"G": GREEN, "g": shade(GREEN, 0.7)}),
    "map_debut": (SLIME, body(GREEN) | {"P": PINK}),
    "first_order": (CART, body(MINT)),
    "first_want": (LETTER, {"K": K, "W": "#f4f2ff", "b": "#b9b4d8", "R": PINK}),
    "first_trade": (SWAP, body(YELLOW) | {"G": MINT, "g": shade(MINT, 1.4)}),
    "reviewer": (BUBBLE, {"K": K, "W": "#f4f2ff", "Y": YELLOW}),
    "collector": (BACKPACK, body(BLUE) | {"Y": YELLOW}),
    "santa": (GIFT, body(RED) | {"Y": YELLOW}),
    "wish_done": (STAR, body(YELLOW) | {"P": PINK}),
    "unique_hunter": (GEM, body(GOLD)),
    "regular": (HOUSE, {"K": K, "R": RED, "H": shade(RED, 1.4), "W": "#f4f2ff", "Y": YELLOW, "d": "#8a5a3c"}),
    "top_buyer": (CROWN, body(GOLD) | {"R": RED, "G": MINT}),
}
for tier, color in TIER_COLOR.items():
    BADGE_SPRITES[f"trader_{tier}"] = (with_pips(COIN, tier), body(color) | {"P": color})
    BADGE_SPRITES[f"hearts_{tier}"] = (with_pips(TROPHY, tier), body(color) | {"P": color})


def canvas(rows: list[str]) -> list[str]:
    """16×16 가운데에 맞춘다 (모자란 줄은 위아래로 나눠 채움)"""
    assert all(len(row) == SIZE for row in rows), [row for row in rows if len(row) != SIZE]
    assert len(rows) <= SIZE
    top = (SIZE - len(rows)) // 2
    return ["." * SIZE] * top + rows + ["." * SIZE] * (SIZE - len(rows) - top)


def rgba(color: str) -> bytes:
    return bytes((int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16), 255))


def png(pixels: list[list[bytes]]) -> bytes:
    raw = b"".join(b"\x00" + b"".join(row) for row in pixels)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", len(pixels[0]), len(pixels), 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


CLEAR = b"\x00\x00\x00\x00"


def badge_pixels(code: str) -> list[list[bytes]]:
    rows, palette = BADGE_SPRITES[code]
    return [[rgba(palette[c]) if c in palette else CLEAR for c in row] for row in canvas(rows)]


def sheet(codes: list[str], scale: int = 8, cols: int = 5, gap: int = 4) -> bytes:
    """미리보기 한 장 (밤하늘 배경 위에 확대)"""
    cell = SIZE * scale
    lines = (len(codes) + cols - 1) // cols
    width, height = cols * cell + (cols + 1) * gap * scale // 2, lines * cell + (lines + 1) * gap * scale // 2
    bg = rgba("#15122b")
    pixels = [[bg] * width for _ in range(height)]
    for index, code in enumerate(codes):
        ox = (index % cols) * (cell + gap * scale // 2) + gap * scale // 2
        oy = (index // cols) * (cell + gap * scale // 2) + gap * scale // 2
        for y, row in enumerate(badge_pixels(code)):
            for x, px in enumerate(row):
                if px != CLEAR:
                    for dy in range(scale):
                        pixels[oy + y * scale + dy][ox + x * scale : ox + (x + 1) * scale] = [px] * scale
    return png(pixels)


ORDER = [
    "new_player", "local", "map_debut", "first_order", "first_want",
    "first_trade", "reviewer", "collector", "santa", "wish_done",
    "unique_hunter", "regular", "trader_1", "hearts_1", "trader_2",
    "top_buyer", "hearts_2", "trader_3", "hearts_3",
]  # fmt: skip

if __name__ == "__main__":
    assert sorted(ORDER) == sorted(BADGE_SPRITES)
    if len(sys.argv) == 3 and sys.argv[1] == "--sheet":
        Path(sys.argv[2]).write_bytes(sheet(ORDER))
        print(f"미리보기 저장: {sys.argv[2]}")
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for code in ORDER:
            (OUT / f"{code}.png").write_bytes(png(badge_pixels(code)))
        print(f"{len(ORDER)}개 저장: {OUT}")

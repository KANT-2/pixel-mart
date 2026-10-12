"""덕력지도 샘플 아바타 — 실제 동의자가 적은 지역을 채우는 다양한 픽셀 캐릭터 (Cold Start Mock, 응답에 isSample)

사람 사진·실존 캐릭터와 무관한 16x16 도트를 코드로 그려 PNG data URL로 만든다. 같은 지역·필터면 늘 같은 구성이다.
"""

import base64
import random
import struct
import zlib
from functools import cache

# K 외곽선, B 몸, b 몸 그림자, H 몸 밝은 부분, E 눈, P 볼, S 피부, h 머리카락, C 옷, c 옷 그림자, X 포인트, W 흰색
SPRITES: dict[str, list[str]] = {
    "slime": [
        "................",
        "................",
        "................",
        "................",
        "......KKKK......",
        "....KKBBBBKK....",
        "...KBBHHBBBBK...",
        "..KBBHHBBBBBBK..",
        "..KBBBBBBBBBBK..",
        ".KBBBBBBBBBBBBK.",
        ".KBBBEBBBBEBBBK.",
        "KBBBBEBBBBEBBBBK",
        "KBPPBBBEEBBBPPBK",
        "KBBBBBBBBBBBBBBK",
        "KbbbbbbbbbbbbbbK",
        ".KKKKKKKKKKKKKK.",
    ],
    "cat": [
        "................",
        "..KK........KK..",
        "..KBK......KBK..",
        "..KBBKKKKKKBBK..",
        "..KBBBBBBBBBBK..",
        ".KBBBBBBBBBBBBK.",
        ".KBBEBBBBBBEBBK.",
        ".KBBEBBBBBBEBBK.",
        ".KBPBBBKKBBBPBK.",
        ".KBBBBBBBBBBBBK.",
        "..KBBBBBBBBBBK..",
        "...KKBBBBBBKK...",
        "...KBBHHHHBBK...",
        "...KBBHHHHBBK...",
        "...KbbKbbKbbK...",
        "....KK.KK.KK....",
    ],
    "bear": [
        "................",
        ".KKK........KKK.",
        "KBPBK......KBPBK",
        "KBBBKKKKKKKKBBBK",
        ".KBBBBBBBBBBBBK.",
        ".KBBBBBBBBBBBBK.",
        ".KBBEBBBBBBEBBK.",
        ".KBBBBBHHBBBBBK.",
        ".KBBBBHKKHBBBBK.",
        ".KBBBBBHHBBBBBK.",
        "..KBBBBBBBBBBK..",
        "...KKKBBBBKKK...",
        "...KBBBBBBBBK...",
        "...KBBHHHHBBK...",
        "...KbbK..KbbK...",
        "....KK....KK....",
    ],
    "bunny": [
        "....KK....KK....",
        "...KBPK..KPBK...",
        "...KBPK..KPBK...",
        "...KBPK..KPBK...",
        "...KBBK..KBBK...",
        "..KKBBBKKBBBKK..",
        ".KBBBBBBBBBBBBK.",
        ".KBBEBBBBBBEBBK.",
        ".KBBEBBBBBBEBBK.",
        ".KBPBBBKKBBBPBK.",
        "..KBBBBBBBBBBK..",
        "...KKBBBBBBKK...",
        "...KBBBBBBBBK...",
        "...KBBHHHHBBK...",
        "...KbbK..KbbK...",
        "....KK....KK....",
    ],
    "person": [
        "....KKKKKKKK....",
        "...KhhhhhhhhK...",
        "..KhhhhhhhhhhK..",
        "..KhhSSSSSShhK..",
        "..KhSSSSSSSShK..",
        "..KSSESSSSESSK..",
        "..KSSESSSSESSK..",
        "..KSPSSSSSSPSK..",
        "...KSSSKKSSSK...",
        "....KKSSSSKK....",
        "...KCCKKKKCCK...",
        "..KCCCCCCCCCCK..",
        "..KSKCCCCCCKSK..",
        "...KKCCCCCCKK...",
        "....KccKKccK....",
        "....KKK..KKK....",
    ],
    "person_long": [
        "....KKKKKKKK....",
        "...KhhhhhhhhK...",
        "..KhhhhhhhhhhK..",
        "..KhhSSSSSShhK..",
        "..KhSSSSSSSShK..",
        "..KhSESSSSEShK..",
        "..KhSESSSSEShK..",
        "..KhPSSSSSSPhK..",
        "..KhhSSKKSShhK..",
        "..KhhKSSSSKhhK..",
        "..KhKCKKKKCKhK..",
        "..KCCCCCCCCCCK..",
        "..KSKCCCCCCKSK..",
        "...KKCCCCCCKK...",
        "....KccKKccK....",
        "....KKK..KKK....",
    ],
    "robot": [
        ".......KK.......",
        ".......XK.......",
        "...KKKKKKKKKK...",
        "..KBBBBBBBBBBK..",
        "..KBKKKKKKKKBK..",
        "..KBKXXKKXXKBK..",
        "..KBKKKKKKKKBK..",
        "..KBBBBBBBBBBK..",
        "..KBBKKKKKKBBK..",
        "...KKKKKKKKKK...",
        "..KCCCCCCCCCCK..",
        ".KBKCCXXXXCCKBK.",
        ".KBKCCCCCCCCKBK.",
        "..KKCCCCCCCCKK..",
        "...KccK..KccK...",
        "...KKKK..KKKK...",
    ],
    "ghost": [
        "................",
        ".....KKKKKK.....",
        "...KKBBBBBBKK...",
        "..KBBHHBBBBBBK..",
        "..KBHHBBBBBBBK..",
        ".KBBBEEBBEEBBBK.",
        ".KBBBEEBBEEBBBK.",
        ".KBBBBBBBBBBBBK.",
        ".KBPBBBKKBBBPBK.",
        ".KBBBBBBBBBBBBK.",
        ".KBBBBBBBBBBBBK.",
        ".KBBBBBBBBBBBBK.",
        ".KbBBBBBBBBBBbK.",
        ".KbbBbbBBbbBbbK.",
        ".KKbKKbKKbKKbKK.",
        "..K..K..K..K....",
    ],
    "frog": [
        "................",
        "................",
        "...KKK....KKK...",
        "..KWWWK..KWWWK..",
        "..KWEWKKKKWEWK..",
        ".KBBBBBBBBBBBBK.",
        "KBBBBBBBBBBBBBBK",
        "KBPBBBBBBBBBBPBK",
        "KBBKBBBBBBBBKBBK",
        ".KBBKKKKKKKKBBK.",
        "..KBBBBBBBBBBK..",
        ".KbBBHHHHHHBBbK.",
        ".KbBHHHHHHHHBbK.",
        "KbbBBBBBBBBBBbbK",
        "KKKKKbbKKbbKKKKK",
        "................",
    ],
}

# 종류별 색 조합 (몸 색, 포인트 색) — 그림자·밝은 부분은 몸 색에서 만든다
BODY_COLORS: dict[str, list[tuple[str, str]]] = {
    "slime": [("#9dff4f", ""), ("#5cc8ff", ""), ("#ff8ab8", ""), ("#a78bff", ""), ("#ffb347", ""), ("#6ef2d6", "")],
    "cat": [("#f2a65a", ""), ("#b8b8c8", ""), ("#5a5266", ""), ("#f5e6c8", "")],
    "bear": [("#a86b3c", ""), ("#e8d2a6", ""), ("#f0f0f0", "")],
    "bunny": [("#f6f2ff", ""), ("#ffc4dc", ""), ("#c9c3d6", "")],
    "robot": [("#c8d0e8", "#6ef2d6"), ("#ffd54a", "#ff4d6d"), ("#8fa3c8", "#b6ff5c")],
    "ghost": [("#e6e2ff", ""), ("#c9f2ff", ""), ("#ffe0f0", "")],
    "frog": [("#6cc04a", ""), ("#38a89a", ""), ("#c8e64a", "")],
}
SKINS = ["#ffdcbc", "#f1c09a", "#d79a6b", "#9c6644"]
HAIRS = ["#2b1d14", "#6b4220", "#e8c25a", "#ff8ab8", "#5b3fc8", "#d6dcff"]
CLOTHES = ["#4caf6a", "#5c7cff", "#ff4d6d", "#ffb347", "#a78bff", "#38a89a"]

OUTLINE = "#14102a"
CHEEK = "#ff8ab8"
WHITE = "#ffffff"


def _rgb(color: str) -> tuple[int, int, int]:
    return int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)


def _mix(color: str, factor: float) -> str:
    """factor < 1이면 어둡게, > 1이면 흰색 쪽으로 밝게"""
    r, g, b = _rgb(color)
    if factor <= 1:
        r, g, b = (int(v * factor) for v in (r, g, b))
    else:
        t = factor - 1
        r, g, b = (int(v + (255 - v) * t) for v in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


def _png(rows: list[str], palette: dict[str, str]) -> bytes:
    """투명 배경 RGBA PNG (표준 라이브러리만 사용)"""
    raw = b""
    for row in rows:
        raw += b"\x00"
        for char in row:
            raw += bytes((*_rgb(palette[char]), 255)) if char in palette else b"\x00\x00\x00\x00"

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", len(rows[0]), len(rows), 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def _palette(body: str, point: str = "") -> dict[str, str]:
    return {
        "K": OUTLINE,
        "B": body,
        "b": _mix(body, 0.72),
        "H": _mix(body, 1.55),
        "E": OUTLINE,
        "P": CHEEK,
        "X": point or WHITE,
        "W": WHITE,
    }


@cache
def sample_pool() -> tuple[str, ...]:
    """서로 다른 샘플 캐릭터 PNG data URL 목록 (처음 한 번만 그린다)"""
    images: list[bytes] = []
    for kind, colors in BODY_COLORS.items():
        for body, point in colors:
            images.append(_png(SPRITES[kind], _palette(body, point)))
    # 사람은 피부·머리·옷 색과 머리 모양을 섞어 만든다 (동물·캐릭터와 비슷한 수)
    for i, (skin, hair) in enumerate((skin, hair) for skin in SKINS for hair in HAIRS):
        cloth = CLOTHES[(i * 5) % len(CLOTHES)]
        palette = {**_palette(cloth), "S": skin, "h": hair, "C": cloth, "c": _mix(cloth, 0.72)}
        images.append(_png(SPRITES["person_long" if i % 3 == 0 else "person"], palette))
    return tuple("data:image/png;base64," + base64.b64encode(png).decode() for png in images)


def sample_avatars(key: str, n: int) -> list[str]:
    """key(지역·필터)마다 고정된 무작위 구성으로 n개 — 풀보다 많으면 섞어서 반복"""
    pool = list(sample_pool())
    rng = random.Random(key)
    out: list[str] = []
    while len(out) < n:
        rng.shuffle(pool)
        out.extend(pool[: n - len(out)])
    return out


NICK_HEADS = ["픽셀", "도트", "레트로", "8비트", "네온", "코인", "하트", "슬라임", "키캡", "무드등"]
NICK_TAILS = ["수집가", "모험가", "장인", "덕후", "러버", "마스터", "탐험가", "요정", "기사", "상인"]


def sample_nicknames(key: str, n: int) -> list[str]:
    """샘플 캐릭터 이름 — 실제 사용자와 겹치지 않게 '샘플' 표시는 화면에서 붙인다"""
    rng = random.Random(f"nick:{key}")
    return [f"{rng.choice(NICK_HEADS)}{rng.choice(NICK_TAILS)}{rng.randint(1, 99)}" for _ in range(n)]


def named_pngs() -> dict[str, bytes]:
    """화면 아이콘용 캐릭터 PNG — `<종류>-<번호>` (tools/gen_characters.py가 public/images/characters/에 저장)"""
    out: dict[str, bytes] = {}
    for kind, colors in BODY_COLORS.items():
        for n, (body, point) in enumerate(colors, 1):
            out[f"{kind}-{n}"] = _png(SPRITES[kind], _palette(body, point))
    for n, (skin, hair, cloth) in enumerate(
        [(SKINS[0], HAIRS[0], CLOTHES[1]), (SKINS[1], HAIRS[2], CLOTHES[2]), (SKINS[2], HAIRS[4], CLOTHES[0])], 1
    ):
        palette = {**_palette(cloth), "S": skin, "h": hair, "C": cloth, "c": _mix(cloth, 0.72)}
        out[f"person-{n}"] = _png(SPRITES["person_long" if n == 2 else "person"], palette)
    return out

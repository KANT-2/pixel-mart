"""PIXEL MART 상품 이미지(SVG) 생성기.

문자 맵으로 그린 픽셀 스프라이트를 600x600 상품 이미지로 만들어 public/images/에 저장합니다.
외부 이미지 링크가 깨질 걱정이 없고, 저작권 문제도 없습니다.

실행: python tools/gen_images.py
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "images"

PAL = {
    "K": "#14102a", "W": "#ffffff",
    "G": "#9dff4f", "g": "#3fa828", "L": "#e2ffbf", "P": "#ff8ab8",
    "R": "#ff4d6d", "r": "#a8203d",
    "Y": "#ffd54a", "O": "#c98a14",
    "S": "#d6dcff", "s": "#8a93c9",
    "B": "#6b4220", "b": "#b57a3c",
    "V": "#a78bff", "v": "#5b3fc8",
    "I": "#b6ff5c", "T": "#6ef2d6",
}

SPRITES = {
    "slime": [
        "......gggg......",
        "....ggGGGGgg....",
        "...gGGLLGGGGg...",
        "..gGGLLGGGGGGg..",
        "..gGGGGGGGGGGg..",
        ".gGGGGGGGGGGGGg.",
        ".gGGGKGGGGKGGGg.",
        "gGGGGKGGGGKGGGGg",
        "gGPPGGGKKGGGPPGg",
        "gGGGGGGGGGGGGGGg",
        "gGGGGGGGGGGGGGGg",
        ".gggggggggggggg.",
    ],
    "heart": [
        ".rr...rr.",
        "rRWr.rRRr",
        "rWRRrRRRr",
        "rRRRRRRRr",
        ".rRRRRRr.",
        "..rRRRr..",
        "...rRr...",
        "....r....",
    ],
    "coin": [
        "..OOOO..",
        ".OYYYYO.",
        "OYWYYYYO",
        "OYWYOYYO",
        "OYYYOYYO",
        "OYYYYYYO",
        ".OYYYYO.",
        "..OOOO..",
    ],
    "invader": [
        "..I.....I..",
        "...I...I...",
        "..IIIIIII..",
        ".II.III.II.",
        "IIIIIIIIIII",
        "I.IIIIIII.I",
        "I.I.....I.I",
        "...II.II...",
    ],
    "sword": [
        "...W...",
        "..WSs..",
        "..WSs..",
        "..WSs..",
        "..WSs..",
        "..WSs..",
        "..WSs..",
        "..WSs..",
        "OYYYYYO",
        "...B...",
        "...B...",
        "..YYY..",
    ],
    "chest": [
        "..BBBBBBBB..",
        ".BbbbbbbbbB.",
        "BbbbbbbbbbbB",
        "BbbbbbbbbbbB",
        "OOOOOYYOOOOO",
        "BbbbbYYbbbbB",
        "BbbbbbbbbbbB",
        "BbbbbbbbbbbB",
        "BBBBBBBBBBBB",
    ],
    "gem": [
        "..vVVVv..",
        ".vVWVVVv.",
        "vVWVVVVVv",
        ".vVVVVVv.",
        "..vVVVv..",
        "...vVv...",
        "....v....",
    ],
    "moon": [
        "..MMMM..",
        ".MMM....",
        "MMM.....",
        "MMM.....",
        "MMM.....",
        "MMM.....",
        ".MMM....",
        "..MMMM..",
    ],
    "star": ["..W..", "..W..", "WWWWW", "..W..", "..W.."],
}
PAL["M"] = "#fff3c4"


def sprite(name, x, y, px, extra=""):
    """스프라이트를 (x, y)에 한 칸 px 크기로 그린 <g>를 반환합니다."""
    rows = SPRITES[name]
    rects = []
    for ry, row in enumerate(rows):
        for rx, c in enumerate(row):
            if c in PAL:
                rects.append(f'<rect x="{rx}" y="{ry}" width="1" height="1" fill="{PAL[c]}"/>')
    return f'<g transform="translate({x} {y}) scale({px})" {extra}>{"".join(rects)}</g>'


def size(name, px):
    rows = SPRITES[name]
    return max(len(r) for r in rows) * px, len(rows) * px


def centered(name, cx, cy, px, extra=""):
    w, h = size(name, px)
    return sprite(name, cx - w / 2, cy - h / 2, px, extra)


DEFS = """
<defs>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
    <path d="M24 0H0V24" fill="none" stroke="#ffffff" stroke-opacity=".04" stroke-width="2"/>
  </pattern>
  <filter id="sticker" x="-20%" y="-20%" width="140%" height="140%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="10" result="d"/>
    <feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="o"/>
    <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="24" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
    <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000" flood-opacity=".45"/>
  </filter>
</defs>"""


def canvas(inner, c1, c2="#15122b"):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" shape-rendering="crispEdges">{DEFS}
<radialGradient id="bg" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></radialGradient>
<rect width="600" height="600" fill="url(#bg)"/><rect width="600" height="600" fill="url(#grid)"/>
{inner}
</svg>"""


def keycap(cx, cy, s, color1, color2):
    return (f'<g filter="url(#shadow)" shape-rendering="geometricPrecision">'
            f'<rect x="{cx - s / 2}" y="{cy - s / 2}" width="{s}" height="{s}" rx="{s * .18}" fill="{color2}"/>'
            f'<rect x="{cx - s / 2 + s * .08}" y="{cy - s / 2 + s * .05}" width="{s * .84}" height="{s * .78}" rx="{s * .14}" fill="{color1}"/></g>')


def pad(x, y, w, h, fill, stroke):
    return (f'<g filter="url(#shadow)" shape-rendering="geometricPrecision">'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="8"/></g>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="url(#grid)"/>')


IMAGES = {
    # 1. HP 하트 키캡
    "heart-keycap": canvas(
        keycap(300, 300, 260, "#ff7a96", "#9c1f45") + centered("heart", 300, 285, 15), "#4a1f3d"),
    # 2. 코인 키캡 세트 (3개)
    "coin-keycap-set": canvas(
        keycap(165, 330, 150, "#ffe07a", "#a8730f") + centered("coin", 165, 322, 10)
        + keycap(300, 250, 150, "#ffe07a", "#a8730f") + centered("coin", 300, 242, 10)
        + keycap(435, 330, 150, "#ffe07a", "#a8730f") + centered("coin", 435, 322, 10), "#463216"),
    # 3. 던전 맵 장패드
    "dungeon-deskmat": canvas(
        pad(60, 170, 480, 260, "#23415a", "#2f5675")
        + centered("slime", 170, 330, 7) + centered("sword", 285, 320, 7)
        + centered("chest", 410, 330, 8) + centered("gem", 300, 225, 5), "#1d3a3c"),
    # 4. 인베이더 장패드
    "invader-deskmat": canvas(
        pad(60, 170, 480, 260, "#1b1640", "#3a2f7a")
        + centered("invader", 170, 260, 8) + centered("invader", 300, 260, 8) + centered("invader", 430, 260, 8)
        + centered("invader", 235, 350, 8) + centered("invader", 365, 350, 8), "#2a1f5c"),
    # 5. 슬라임 아크릴 키링
    "slime-keyring": canvas(
        '<g shape-rendering="geometricPrecision"><circle cx="300" cy="130" r="42" fill="none" stroke="#d6dcff" stroke-width="12"/>'
        '<rect x="294" y="168" width="12" height="62" fill="#d6dcff"/></g>'
        + f'<g filter="url(#shadow)"><g filter="url(#sticker)" opacity="1">{centered("slime", 300, 350, 17)}</g></g>', "#2c4a2a"),
    # 6. 픽셀 스티커 팩
    "sticker-pack": canvas(
        f'<g filter="url(#shadow)"><g filter="url(#sticker)">'
        f'<g transform="rotate(-8 190 200)">{centered("heart", 190, 200, 14)}</g>'
        f'<g transform="rotate(7 410 200)">{centered("slime", 410, 200, 9)}</g>'
        f'<g transform="rotate(6 190 410)">{centered("gem", 190, 410, 15)}</g>'
        f'<g transform="rotate(-6 410 410)">{centered("coin", 410, 410, 15)}</g>'
        f'</g></g>', "#33285e"),
    # 7. 보물상자 소품함
    "treasure-box": canvas(
        f'<g filter="url(#shadow)">{centered("chest", 300, 340, 26)}</g>'
        + centered("coin", 170, 170, 10) + centered("coin", 440, 140, 10) + centered("gem", 330, 120, 8), "#463216"),
    # 8. 인베이더 LED 무드등
    "invader-lamp": canvas(
        '<g shape-rendering="geometricPrecision"><rect x="170" y="440" width="260" height="60" rx="14" fill="#2b2552"/>'
        '<rect x="170" y="440" width="260" height="14" rx="7" fill="#4a3f8a"/></g>'
        + f'<g filter="url(#glow)">{centered("invader", 300, 290, 22)}</g>', "#24304a"),
}


def hero_scene():
    """메인 배너용 800x600 픽셀 씬: 성벽 위 슬라임 + 검 + 보물상자."""
    bricks = "".join(
        f'<rect x="{x + (24 if row % 2 else 0)}" y="{430 + row * 28}" width="44" height="22" fill="#2b2552"/>'
        for row in range(6) for x in range(-24, 800, 48)
    )
    hearts = "".join(sprite("heart", 40 + i * 52, 36, 5, 'opacity=".3"' if i == 2 else "") for i in range(3))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" shape-rendering="crispEdges">{DEFS}
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17123a"/><stop offset="1" stop-color="#2a1f5c"/></linearGradient>
<rect width="800" height="600" fill="url(#sky)"/><rect width="800" height="600" fill="url(#grid)"/>
{centered("moon", 400, 90, 6)}{centered("star", 250, 130, 4)}{centered("star", 560, 80, 4)}{centered("star", 700, 200, 4)}
{hearts}{sprite("coin", 640, 36, 5)}
<rect x="0" y="420" width="800" height="180" fill="#1d1838"/><rect x="0" y="416" width="800" height="8" fill="#4a3f8a"/>{bricks}
<g filter="url(#shadow)">{centered("slime", 360, 350, 14)}{centered("sword", 545, 346, 8)}{centered("chest", 660, 372, 9)}</g>
</svg>"""


def logo():
    """헤더·푸터 로고용 투명 배경 인베이더."""
    w, h = size("invader", 1)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">{sprite("invader", 0, 0, 1)}</svg>'


IMAGES["hero-scene"] = hero_scene()
IMAGES["logo-invader"] = logo()


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, svg in IMAGES.items():
        (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")
        print("wrote", OUT / f"{name}.svg")

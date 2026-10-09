"""PIXEL LOCAL 픽셀 지도 데이터 생성기 → lib/localMapData.ts

행정구역 경계(통계청 2013, github.com/southkorea/southkorea-maps)를 픽셀 격자로 줄입니다.
원본 GeoJSON은 저장소에 넣지 않고, 생성 결과(lib/localMapData.ts)만 커밋합니다.

준비 (아무 폴더에 다운로드):
  kostat/2013/json/skorea_municipalities_geo_simple.json      (약 370KB)
  kostat/2013/json/skorea_submunicipalities_geo_simple.json   (약 1.7MB)

실행:
  python tools/build_local_map.py <다운로드 폴더> backend/seed/regions.json lib/localMapData.ts <로그 파일>

시드 지역(backend/seed/regions.json)을 바꾸면 아래 SIDO·SIGUNGU·ZONES 매핑도 함께 고치고 다시 생성하세요.
"""
import json
import math
import sys

D, seed_path, out_path, log_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
mun = json.load(open(D + "/skorea_municipalities_geo_simple.json", encoding="utf-8"))["features"]
sub = json.load(open(D + "/skorea_submunicipalities_geo_simple.json", encoding="utf-8"))["features"]
regions = json.load(open(seed_path, encoding="utf-8"))

SIDO = {"11": ["11"], "28": ["23"], "41110": ["3101"], "41130": ["3102"], "41460": ["3119"]}
SIDO_EXCLUDE = {"28": ["23310", "23320"]}  # 인천: 강화·옹진 섬 지역은 서비스 블록에서 제외
SIGUNGU = {"11200": "11040", "11440": "11140", "11650": "11220", "11680": "11230", "11710": "11240",
           "28185": "23040", "28237": "23060", "41115": "31013", "41117": "31014", "41131": "31021",
           "41135": "31023", "41463": "31192", "41465": "31193"}
ZONES = {
    "11200-01": ["성수1가1동", "성수1가2동", "성수2가1동", "성수2가3동"],
    "11440-01": ["서교동", "합정동"], "11440-02": ["연남동"],
    "11650-01": ["반포본동", "반포1동", "반포2동", "반포3동", "반포4동"], "11650-02": ["서초2동", "서초4동"],
    "11680-01": ["역삼1동", "역삼2동"], "11680-02": ["삼성1동", "삼성2동"], "11680-03": ["신사동"],
    "11710-01": ["잠실본동", "잠실2동", "잠실3동", "잠실4동", "잠실6동", "잠실7동"], "11710-02": ["문정1동", "문정2동"],
    "28185-01": ["송도1동", "송도2동"], "28237-01": ["부평1동", "부평2동"],
    "41115-01": ["인계동"], "41117-01": ["광교동"], "41117-02": ["영통1동", "영통2동"],
    "41131-01": ["신흥1동", "신흥2동", "신흥3동"],
    "41135-01": ["판교동", "삼평동", "백현동"], "41135-02": ["정자1동", "정자2동", "정자3동"],
    "41135-03": ["서현1동", "서현2동"], "41135-04": ["야탑1동", "야탑2동", "야탑3동"],
    "41463-01": ["보정동"], "41465-01": ["죽전1동", "죽전2동"], "41465-02": ["동천동"],
}
METRO = ("11", "23", "31")  # 서울·인천·경기 — 배경 땅


def polys(feature):
    g = feature["geometry"]
    rings = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return [p[0] for p in rings]  # 바깥 고리만 (구멍은 이 축척에서 무시)


def bbox(rings):
    xs = [x for r in rings for x, _ in r]
    ys = [y for r in rings for _, y in r]
    return min(xs), min(ys), max(xs), max(ys)


def inside(x, y, ring):
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


class Shape:
    def __init__(self, feats):
        self.rings = [r for f in feats for r in polys(f)]
        self.boxes = [bbox([r]) for r in self.rings]
        self.box = bbox(self.rings)

    def contains(self, x, y):
        return any(b[0] <= x <= b[2] and b[1] <= y <= b[3] and inside(x, y, r) for r, b in zip(self.rings, self.boxes))


def mun_with(prefixes, exclude=()):
    return [f for f in mun if any(f["properties"]["code"].startswith(p) for p in prefixes)
            and f["properties"]["code"] not in exclude]


def sub_named(parent, names):
    found = [f for f in sub if f["properties"]["code"].startswith(parent) and f["properties"]["name"] in names]
    assert len(found) == len(names), (parent, names, [f["properties"]["name"] for f in found])
    return found


land_metro = Shape(mun_with(METRO))
sido_shape = {c: Shape(mun_with(p, SIDO_EXCLUDE.get(c, ()))) for c, p in SIDO.items()}
gu_shape = {c: Shape(mun_with([k])) for c, k in SIGUNGU.items()}
zone_shape = {z: Shape(sub_named(SIGUNGU[z.split("-")[0]], names)) for z, names in ZONES.items()}
city_land = {c: Shape(mun_with(p)) for c, p in SIDO.items()}

KX = math.cos(math.radians(37.4))  # 경도 1도의 실제 길이 보정


def grid(box, cols, pad=0.06):
    x0, y0, x1, y1 = box
    w, h = (x1 - x0) * KX, (y1 - y0)
    x0 -= w * pad / KX
    x1 += w * pad / KX
    y0 -= h * pad
    y1 += h * pad
    w, h = (x1 - x0) * KX, (y1 - y0)
    rows = max(8, round(cols * h / w))
    return x0, y0, (x1 - x0) / cols, (y1 - y0) / rows, cols, rows


def rasterize(box, cols, members, inner_land, outer_land):
    x0, y0, dx, dy, cols, rows = grid(box, cols)
    out = []
    for r in range(rows):
        y = y0 + (rows - r - 0.5) * dy  # 위쪽이 북쪽
        row = []
        for c in range(cols):
            x = x0 + (c + 0.5) * dx
            ch = "."
            for i, (_, shape) in enumerate(members):
                if shape.contains(x, y):
                    ch = chr(97 + i)
                    break
            else:
                if inner_land is not None and inner_land.contains(x, y):
                    ch = "#"
                elif outer_land.contains(x, y):
                    ch = ","
            row.append(ch)
        out.append("".join(row))
    for i, (code, _) in enumerate(members):
        assert any(chr(97 + i) in row for row in out), ("블록이 격자에 안 잡힘", code)
    return {"legend": [code for code, _ in members], "cols": cols, "rows": rows, "rows_data": out}


def rle(row):
    out, i = [], 0
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]:
            j += 1
        n = j - i
        out.append(row[i] if n == 1 else f"{n}{row[i]}")
        i = j
    return "".join(out)


def union_box(shapes):
    bs = [s.box for s in shapes]
    return min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)


by_parent = {}
for r in regions:
    by_parent.setdefault(r["parentCode"], []).append(r["code"])

views = {"": rasterize(union_box(sido_shape.values()), 72,
                       [(c, sido_shape[c]) for c in sorted(by_parent[None])], None, land_metro)}
for c in sorted(by_parent[None]):
    views[c] = rasterize(sido_shape[c].box, 48, [(k, gu_shape[k]) for k in sorted(by_parent[c])], city_land[c], land_metro)
for c in sorted(SIGUNGU):
    views[c] = rasterize(gu_shape[c].box, 44, [(k, zone_shape[k]) for k in sorted(by_parent.get(c, []))],
                         gu_shape[c], land_metro)


def center(shape):
    x0, y0, x1, y1 = shape.box
    pts = [(x0 + (x1 - x0) * (i + .5) / 40, y0 + (y1 - y0) * (j + .5) / 40) for i in range(40) for j in range(40)]
    pts = [p for p in pts if shape.contains(*p)] or [((x0 + x1) / 2, (y0 + y1) / 2)]
    return round(sum(p[1] for p in pts) / len(pts), 4), round(sum(p[0] for p in pts) / len(pts), 4)


centers = {}
for group in (sido_shape, gu_shape, zone_shape):
    centers.update({c: center(s) for c, s in group.items()})

lines = [
    "// 자동 생성 파일 — 직접 수정하지 말 것.",
    "// 출처: 행정구역 경계(통계청 2013, github.com/southkorea/southkorea-maps)를 픽셀 격자로 줄인 값.",
    "// 문자: '.' 바다·지도 밖, ',' 주변 땅, '#' 보고 있는 지역 안의 서비스 밖 땅, 'a'~ legend 순서의 지역 블록.",
    "// 행은 위가 북쪽이고, '12a'처럼 숫자는 같은 문자의 반복 횟수(run-length)입니다.",
    "",
    "export interface MapViewData {",
    "  cols: number;",
    "  rows: number;",
    "  legend: string[];",
    "  grid: string[];",
    "}",
    "",
    "/** 키: 보고 있는 지역 코드 (\"\"는 서비스 지역 전체) */",
    "export const MAP_VIEWS: Record<string, MapViewData> = {",
]
for code, v in views.items():
    lines += [f"  {json.dumps(code)}: {{", f"    cols: {v['cols']},", f"    rows: {v['rows']},",
              f"    legend: {json.dumps(v['legend'])},", "    grid: ["]
    lines += [f"      {json.dumps(rle(row))}," for row in v["rows_data"]]
    lines += ["    ],", "  },"]
lines += ["};", "", "/** 지역 블록 무게중심 [위도, 경도] — 브라우저 안에서 가까운 지역을 찾는 데만 쓴다 */",
          "export const REGION_CENTERS: Record<string, readonly [number, number]> = {"]
lines += [f"  {json.dumps(c)}: [{lat}, {lng}]," for c, (lat, lng) in sorted(centers.items())]
lines.append("};")
open(out_path, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")

log = [f"views {len(views)} centers {len(centers)}"]
for code in ["", "11", "28", "41135"]:
    log.append(f"== {code or 'ROOT'} {views[code]['legend']}")
    log += views[code]["rows_data"]
open(log_path, "w", encoding="utf-8").write("\n".join(log))

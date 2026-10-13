import { hashSeed, seededRandom, type Cell } from "@/utils/localMap";
import type { ApiInterest } from "@/types/api";

/** 지도 장식 도트 — 외부 이미지 없이 문자 격자로 그린다 (상표·로고 없음) */
export interface Sprite {
  rows: string[];
  palette: Record<string, string>;
  /** 지도 칸 기준 너비 */
  width: number;
}

const K = "#14102a";

export const SPRITES = {
  // 전망 타워
  tower: {
    width: 4,
    palette: { K, W: "#f2f0ff", R: "#ff4d6d", G: "#8a93c9" },
    rows: [
      ".....KK.....",
      ".....WW.....",
      ".....KK.....",
      "....KWWK....",
      "....KRRK....",
      "....KWWK....",
      ".....WW.....",
      ".....WG.....",
      ".....WG.....",
      ".....WG.....",
      "....KWGK....",
      "...KWWGGK...",
      "..KKKKKKKK..",
    ],
  },
  // 성문
  gate: {
    width: 3.6,
    palette: { K, R: "#a8203d", r: "#6b1a2e", W: "#e8dcc0", S: "#b8a98a" },
    rows: [
      "...KKKKKK...",
      "..KrrrrrrK..",
      ".KRRRRRRRRK.",
      "KKKKKKKKKKKK",
      ".KWWWWWWWWK.",
      ".KWSWKKWSWK.",
      ".KWWK..KWWK.",
      ".KWSK..KSWK.",
      "KKKKK..KKKKK",
    ],
  },
  // 등대
  lighthouse: {
    width: 2.6,
    palette: { K, Y: "#ffd54a", W: "#f2f0ff", R: "#ff4d6d" },
    rows: [
      "..KK..",
      ".KYYK.",
      ".KKKK.",
      "..WW..",
      "..RR..",
      "..WW..",
      ".KRRK.",
      ".KWWK.",
      "KKKKKK",
    ],
  },
  // 빌딩 숲
  buildings: {
    width: 4,
    palette: { K, B: "#8fa3c8", b: "#5c6f99", Y: "#ffe58a" },
    rows: [
      "...KKK......",
      "...KBK..KKK.",
      ".KKKYKK.KbK.",
      ".KBBBBK.KYK.",
      ".KBYBYKKKbK.",
      ".KBBBBKbYbK.",
      ".KBYBYKbbbK.",
      ".KBBBBKbYbK.",
      "KKKKKKKKKKKK",
    ],
  },
  // 바다의 배
  boat: {
    width: 2.8,
    palette: { K, W: "#f2f0ff", R: "#ff4d6d", B: "#5c7cff" },
    rows: [
      "....K...",
      "....KW..",
      "....KWW.",
      "....KRRR",
      "KKKKKKKK",
      ".KBBBBK.",
    ],
  },
} satisfies Record<string, Sprite>;

export type SpriteName = keyof typeof SPRITES;

/** 전체 지도의 지역별 랜드마크 */
export const LANDMARKS: Record<string, SpriteName> = {
  "11": "tower",
  "28": "lighthouse",
  "41110": "gate",
  "41130": "buildings",
  "41460": "buildings",
};

/** 스프라이트를 (x, y)에 그리는 색별 SVG path */
export function spritePaths(sprite: Sprite, x: number, y: number): { fill: string; d: string }[] {
  const size = sprite.width / sprite.rows[0].length;
  const byColor = new Map<string, string>();
  sprite.rows.forEach((row, py) => {
    for (let px = 0; px < row.length; px++) {
      const fill = sprite.palette[row[px] as keyof typeof sprite.palette];
      if (!fill) continue;
      byColor.set(fill, (byColor.get(fill) ?? "") + `M${(x + px * size).toFixed(3)} ${(y + py * size).toFixed(3)}h${size.toFixed(3)}v${size.toFixed(3)}h-${size.toFixed(3)}z`);
    }
  });
  return [...byColor].map(([fill, d]) => ({ fill, d }));
}

export const spriteHeight = (sprite: Sprite) => (sprite.width / sprite.rows[0].length) * sprite.rows.length;

/** 스프라이트가 덮는 칸인지 — 캐릭터 핀이 랜드마크를 가리지 않게 */
export function coversCell(sprite: Sprite, spot: Cell, cell: Cell): boolean {
  return cell[0] >= spot[0] - 1 && cell[0] <= spot[0] + Math.ceil(sprite.width) && cell[1] >= spot[1] - 1 && cell[1] <= spot[1] + Math.ceil(spriteHeight(sprite));
}

/**
 * 블록 안에 스프라이트가 통째로 들어가는 왼쪽 위 칸 — 이름표에서 3칸 이상 떨어진 곳 중 시드로 하나.
 * 들어갈 자리가 없으면 null.
 */
export function placeSprite(cells: Cell[], sprite: Sprite, seed: number, avoid: Cell | null = null): Cell | null {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const w = Math.ceil(sprite.width);
  const h = Math.ceil(spriteHeight(sprite));
  const fits = cells.filter(([x, y]) => {
    if (avoid && Math.abs(x + w / 2 - avoid[0]) < 3 + w / 2 && Math.abs(y + h / 2 - avoid[1]) < 2 + h / 2) return false;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!set.has(`${x + dx},${y + dy}`)) return false;
    return true;
  });
  if (!fits.length) return avoid ? placeSprite(cells, sprite, seed) : null; // 이름표를 피할 자리가 없으면 겹쳐도 그린다
  return fits[Math.floor(seededRandom(seed)() * fits.length)];
}

/** 바다('.')에서 배를 띄울 자리 n개 — 서로 4칸 이상 떨어지게 */
export function seaSpots(rows: string[], sprite: Sprite, n: number, seed: number): Cell[] {
  const w = Math.ceil(sprite.width);
  const h = Math.ceil(spriteHeight(sprite));
  const open: Cell[] = [];
  for (let y = 1; y + h < rows.length; y++) {
    for (let x = 1; x + w < rows[y].length; x++) {
      let ok = true;
      for (let dy = -1; ok && dy <= h; dy++) for (let dx = -1; ok && dx <= w; dx++) if (rows[y + dy]?.[x + dx] !== ".") ok = false;
      if (ok) open.push([x, y]);
    }
  }
  const random = seededRandom(seed);
  const picked: Cell[] = [];
  for (let tries = 0; picked.length < n && tries < open.length * 2; tries++) {
    const cell = open[Math.floor(random() * open.length)];
    if (cell && picked.every(([x, y]) => Math.abs(x - cell[0]) + Math.abs(y - cell[1]) >= 6)) picked.push(cell);
  }
  return picked;
}

/** 지역 색 단계 — 보고 있는 지도에서 가장 많은 곳 대비 적음(0)·보통(1)·많음(2), 없으면 null */
export function heatTier(count: number | null, max: number): 0 | 1 | 2 | null {
  if (!count || max <= 0) return null;
  const ratio = count / max;
  return ratio > 2 / 3 ? 2 : ratio > 1 / 3 ? 1 : 0;
}

export const HEAT_COLORS = ["#a6dc6e", "#62b84a", "#2f8a45"] as const;
export const HEAT_NONE = "#8fa682";
export const HEAT_LABELS = ["적음", "보통", "많음"] as const;

/** 시 단계 이름은 짧게 (서울특별시 → 서울, 수원시 → 수원) */
export function shortRegionName(name: string, level?: string): string {
  return level === "sido" ? name.replace(/(특별시|광역시|시)$/, "") || name : name;
}

const CHARACTER_FILES = [
  "slime-1", "slime-2", "slime-3", "slime-4", "slime-5", "slime-6", "cat-1", "cat-2", "cat-3", "cat-4", "bear-1", "bear-2", "bear-3",
  "bunny-1", "bunny-2", "bunny-3", "robot-1", "robot-2", "robot-3", "ghost-1", "ghost-2", "ghost-3", "frog-1", "frog-2", "frog-3",
  "person-1", "person-2", "person-3",
];

// 장르 이름 태그만 어울리는 캐릭터로, 실제 작품은 무작위 (공식 캐릭터를 흉내 내지 않게)
const ICON_BY_NAME: Record<string, string> = {
  "레트로 RPG": "person-1", "픽셀 게임": "slime-1", "던전 크롤러": "ghost-1",
};

/** 취향 칩 아이콘 (public/images/characters — tools/gen_characters.py) */
export function interestIcon(item: Pick<ApiInterest, "id" | "name">): string {
  const file = ICON_BY_NAME[item.name] ?? CHARACTER_FILES[hashSeed(`interest:${item.id}`) % CHARACTER_FILES.length];
  return `/images/characters/${file}.png`;
}

export const characterIcon = (name: string) => `/images/characters/${name}.png`;

// 키캡 피팅룸 키보드 — 키캡을 뺀 RGB 스위치 사진 위에 키캡을 끼운다.
// 좌표는 사진(1957×804) 기준 — public/assets/keyboards/wooting-80he-ansi/preview-layered.js 의 사진용 좌표와 같음 (1u = 104px)

export interface KeyboardKey {
  id: string;
  label: string;
  /** 키 칸의 왼쪽 위(px)와 너비(u) */
  x: number;
  y: number;
  w: number;
}

export interface KeyboardSwitch { id: string; label: string; image: string; }

export interface KeyboardModel {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 1u 칸 크기와, 칸 안에서 키캡까지의 여백 */
  unitPx: number;
  insetPx: number;
  switches: KeyboardSwitch[];
  keys: KeyboardKey[];
}

const U = 104;
const keys: KeyboardKey[] = [];
const add = (id: string, label: string, x: number, y: number, w = 1) => keys.push({ id, label, x, y, w });
/** 한 줄을 왼쪽(79px)부터 차례로 — [id, 각인, 너비] */
const row = (y: number, items: [string, string, number][]) => {
  let x = 79;
  for (const [id, label, w] of items) { add(id, label, x, y, w); x += w * U; }
};

add("Escape", "Esc", 79, 94);
[201, 305, 409, 513, 648, 752, 856, 960, 1094, 1198, 1302, 1406].forEach((x, i) => add(`F${i + 1}`, `F${i + 1}`, x, 94));
add("Mode", "Mode", 1540, 94); add("PrintScreen", "PrtSc", 1668, 94); add("Pause", "Pause", 1772, 94);
row(216, [["Backquote", "`", 1], ...["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d): [string, string, number] => [`Digit${d}`, d, 1]), ["Minus", "−", 1], ["Equal", "=", 1], ["Backspace", "Backspace", 2]]);
row(320, [["Tab", "Tab", 1.5], ...[..."QWERTYUIOP"].map((c): [string, string, number] => [`Key${c}`, c, 1]), ["BracketLeft", "[", 1], ["BracketRight", "]", 1], ["Backslash", "\\", 1.5]]);
row(424, [["CapsLock", "Caps", 1.75], ...[..."ASDFGHJKL"].map((c): [string, string, number] => [`Key${c}`, c, 1]), ["Semicolon", ";", 1], ["Quote", "'", 1], ["Enter", "Enter", 2.25]]);
row(528, [["ShiftLeft", "Shift", 2.25], ...[..."ZXCVBNM"].map((c): [string, string, number] => [`Key${c}`, c, 1]), ["Comma", ",", 1], ["Period", ".", 1], ["Slash", "/", 1], ["ShiftRight", "Shift", 2.75]]);
row(632, [["ControlLeft", "Ctrl", 1.25], ["MetaLeft", "Win", 1.25], ["AltLeft", "Alt", 1.25], ["Space", "", 6.25], ["AltRight", "Alt", 1.25], ["ControlRight", "Ctrl", 1.25], ["Fn", "Fn", 1.25]]);
add("Insert", "Ins", 1668, 216); add("PageUp", "PgUp", 1772, 216); add("Delete", "Del", 1668, 320); add("PageDown", "PgDn", 1772, 320);
add("ArrowUp", "↑", 1668, 528); add("ArrowLeft", "←", 1558, 632); add("ArrowDown", "↓", 1668, 632); add("ArrowRight", "→", 1772, 632);

export const WOOTING_80HE: KeyboardModel = {
  id: "wooting-80he-ansi",
  name: "Wooting 80HE",
  width: 1957,
  height: 804,
  unitPx: U,
  insetPx: 3,
  switches: [
    { id: "black", label: "블랙 스위치", image: "/images/keyboards/wooting-80he-black.webp" },
    { id: "mint", label: "민트 스위치", image: "/images/keyboards/wooting-80he-mint.webp" },
  ],
  keys,
};

/** 방향키 세트가 들어가는 자리 (세트 그림 1~4 순서) */
export const ARROW_KEYS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"] as const;

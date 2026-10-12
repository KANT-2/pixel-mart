// 키캡 피팅룸 키보드 배열 — public/assets/keyboards/wooting-80he-ansi/layout.json 에서 옮김 (시각화용, 장착 치수 아님)

export interface KeyboardKey {
  id: string;
  label: string;
  /** 왼쪽 위 위치와 너비 (u, 1u = 키 한 칸) */
  x: number;
  y: number;
  w: number;
}

export interface KeyboardModel {
  id: string;
  name: string;
  /** 그림 좌표: 1u 크기, 시작점, 키 사이 여백, 전체 크기 */
  unitPx: number;
  originX: number;
  originY: number;
  insetPx: number;
  width: number;
  height: number;
  keys: KeyboardKey[];
}

const RAW: [string, string, number, number, number][] = [
  ["Escape", "Esc", 0, 0, 1], ["F1", "F1", 1.25, 0, 1], ["F2", "F2", 2.25, 0, 1], ["F3", "F3", 3.25, 0, 1], ["F4", "F4", 4.25, 0, 1],
  ["F5", "F5", 5.5, 0, 1], ["F6", "F6", 6.5, 0, 1], ["F7", "F7", 7.5, 0, 1], ["F8", "F8", 8.5, 0, 1], ["F9", "F9", 9.75, 0, 1],
  ["F10", "F10", 10.75, 0, 1], ["F11", "F11", 11.75, 0, 1], ["F12", "F12", 12.75, 0, 1], ["Mode", "Mode", 14, 0, 1],
  ["PrintScreen", "PrtSc", 15.25, 0, 1], ["Pause", "Pause", 16.25, 0, 1],
  ["Backquote", "`", 0, 1.25, 1], ["Digit1", "1", 1, 1.25, 1], ["Digit2", "2", 2, 1.25, 1], ["Digit3", "3", 3, 1.25, 1], ["Digit4", "4", 4, 1.25, 1],
  ["Digit5", "5", 5, 1.25, 1], ["Digit6", "6", 6, 1.25, 1], ["Digit7", "7", 7, 1.25, 1], ["Digit8", "8", 8, 1.25, 1], ["Digit9", "9", 9, 1.25, 1],
  ["Digit0", "0", 10, 1.25, 1], ["Minus", "−", 11, 1.25, 1], ["Equal", "=", 12, 1.25, 1], ["Backspace", "Backspace", 13, 1.25, 2],
  ["Tab", "Tab", 0, 2.25, 1.5], ["KeyQ", "Q", 1.5, 2.25, 1], ["KeyW", "W", 2.5, 2.25, 1], ["KeyE", "E", 3.5, 2.25, 1], ["KeyR", "R", 4.5, 2.25, 1],
  ["KeyT", "T", 5.5, 2.25, 1], ["KeyY", "Y", 6.5, 2.25, 1], ["KeyU", "U", 7.5, 2.25, 1], ["KeyI", "I", 8.5, 2.25, 1], ["KeyO", "O", 9.5, 2.25, 1],
  ["KeyP", "P", 10.5, 2.25, 1], ["BracketLeft", "[", 11.5, 2.25, 1], ["BracketRight", "]", 12.5, 2.25, 1], ["Backslash", "\\", 13.5, 2.25, 1.5],
  ["CapsLock", "Caps", 0, 3.25, 1.75], ["KeyA", "A", 1.75, 3.25, 1], ["KeyS", "S", 2.75, 3.25, 1], ["KeyD", "D", 3.75, 3.25, 1], ["KeyF", "F", 4.75, 3.25, 1],
  ["KeyG", "G", 5.75, 3.25, 1], ["KeyH", "H", 6.75, 3.25, 1], ["KeyJ", "J", 7.75, 3.25, 1], ["KeyK", "K", 8.75, 3.25, 1], ["KeyL", "L", 9.75, 3.25, 1],
  ["Semicolon", ";", 10.75, 3.25, 1], ["Quote", "'", 11.75, 3.25, 1], ["Enter", "Enter", 12.75, 3.25, 2.25],
  ["ShiftLeft", "Shift", 0, 4.25, 2.25], ["KeyZ", "Z", 2.25, 4.25, 1], ["KeyX", "X", 3.25, 4.25, 1], ["KeyC", "C", 4.25, 4.25, 1], ["KeyV", "V", 5.25, 4.25, 1],
  ["KeyB", "B", 6.25, 4.25, 1], ["KeyN", "N", 7.25, 4.25, 1], ["KeyM", "M", 8.25, 4.25, 1], ["Comma", ",", 9.25, 4.25, 1], ["Period", ".", 10.25, 4.25, 1],
  ["Slash", "/", 11.25, 4.25, 1], ["ShiftRight", "Shift", 12.25, 4.25, 2.75],
  ["ControlLeft", "Ctrl", 0, 5.25, 1.25], ["MetaLeft", "Win", 1.25, 5.25, 1.25], ["AltLeft", "Alt", 2.5, 5.25, 1.25], ["Space", "", 3.75, 5.25, 6.25],
  ["AltRight", "Alt", 10, 5.25, 1.25], ["ControlRight", "Ctrl", 11.25, 5.25, 1.25], ["Fn", "Fn", 12.5, 5.25, 1.25],
  ["Insert", "Ins", 15.25, 1.25, 1], ["PageUp", "PgUp", 16.25, 1.25, 1], ["Delete", "Del", 15.25, 2.25, 1], ["PageDown", "PgDn", 16.25, 2.25, 1],
  ["ArrowUp", "↑", 15.25, 4.25, 1], ["ArrowLeft", "←", 14.25, 5.25, 1], ["ArrowDown", "↓", 15.25, 5.25, 1], ["ArrowRight", "→", 16.25, 5.25, 1],
];

export const WOOTING_80HE: KeyboardModel = {
  id: "wooting-80he-ansi",
  name: "Wooting 80HE",
  unitPx: 64,
  originX: 29,
  originY: 36,
  insetPx: 3,
  width: 1162,
  height: 477,
  keys: RAW.map(([id, label, x, y, w]) => ({ id, label, x, y, w })),
};

/** 방향키 세트가 들어가는 자리 (세트 그림 1~4 순서) */
export const ARROW_KEYS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"] as const;

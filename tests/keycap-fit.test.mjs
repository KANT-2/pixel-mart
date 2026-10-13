import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/keycapFit.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { placeKeycap, removeKeycap, keycapImage, trayKeycaps, withObject, cartQuantities } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const heart = { id: "resin-heart", name: "HP 하트 키캡", productId: 1, kind: "one", material: "resin", color: "#ad1d1d", tone: "red" };
const space = { id: "coin-spacebar", name: "골드 코인 스페이스바 키캡", productId: 21, kind: "space", material: "opaque", color: "#d6aa44", tone: "gold" };
const arrows = { id: "star-arrows", name: "노란 별 방향키 세트", productId: 69, kind: "set", material: "opaque", color: "#ddb127", tone: "gold" };
const shield = { id: "resin-shield", name: "푸른 방패 아티산 키캡", productId: 51, kind: "one", material: "resin", color: "#193db0", tone: "blue" };
const esc = { id: "Escape", label: "Esc", w: 1 };
const enter = { id: "Enter", label: "Enter", w: 2.25 };
const spaceKey = { id: "Space", label: "", w: 6.25 };

test("1u 키캡은 1u 키에만, 긴 키에는 끼우지 않는다", () => {
  assert.deepEqual(placeKeycap({}, heart, esc).placed, { Escape: "resin-heart" });
  const r = placeKeycap({}, heart, enter);
  assert.equal(r.ok, false);
  assert.deepEqual(r.placed, {});
});

test("스페이스바 키캡은 스페이스바에만", () => {
  assert.equal(placeKeycap({}, space, esc).ok, false);
  assert.deepEqual(placeKeycap({}, space, spaceKey).placed, { Space: "coin-spacebar" });
});

test("방향키 세트는 어디에 놓아도 방향키 4개에, 뺄 때도 4개 함께", () => {
  const { placed } = placeKeycap({ Escape: "resin-heart" }, arrows, esc);
  assert.deepEqual(placed, { Escape: "resin-heart", ArrowUp: "star-arrows", ArrowLeft: "star-arrows", ArrowDown: "star-arrows", ArrowRight: "star-arrows" });
  assert.deepEqual(removeKeycap(placed, "ArrowDown", "set"), { Escape: "resin-heart" });
  assert.equal(keycapImage(arrows, "ArrowDown"), "/images/keycaps/star-arrows-3.webp");
  assert.equal(keycapImage(heart), "/images/keycaps/resin-heart.webp");
});


test("서랍 — 보던 키캡이 맨 앞, 이름 검색은 띄어쓰기 무시", () => {
  const all = [space, shield, heart, arrows];
  assert.deepEqual(trayKeycaps(all, "resin-heart", "all", "").map((i) => i.id), ["resin-heart", "coin-spacebar", "resin-shield", "star-arrows"]);
  assert.deepEqual(trayKeycaps(all, "resin-heart", "all", "방패아티산").map((i) => i.id), ["resin-shield"]);
  assert.deepEqual(trayKeycaps(all, null, "space", "").map((i) => i.id), ["coin-spacebar"]);
});


test("조사 — 받침 있으면 을, 없으면 를", () => {
  assert.equal(withObject("HP 하트 키캡"), "HP 하트 키캡을");
  assert.equal(withObject("노란 별 방향키 세트"), "노란 별 방향키 세트를");
});


test("서랍 색 필터 — 고른 색 묶음만", () => {
  const all = [space, shield, heart, arrows];
  assert.deepEqual(trayKeycaps(all, "resin-heart", "all", "", "gold").map((i) => i.id), ["coin-spacebar", "star-arrows"]);
  assert.deepEqual(trayKeycaps(all, "resin-heart", "one", "", "blue").map((i) => i.id), ["resin-shield"]);
});

test("조합 담기 수량 — 단품은 끼운 자리 수만큼, 방향키·스페이스바는 1개, 여러 개 구성 세트는 필요한 세트 수", () => {
  const coin = { id: "resin-coin", name: "코인 키캡 세트", productId: 2, kind: "one", material: "resin", color: "#ae7c20", tone: "gold", pack: 3 };
  const placed = {
    Escape: "resin-heart", KeyQ: "resin-heart",
    ArrowUp: "star-arrows", ArrowLeft: "star-arrows", ArrowDown: "star-arrows", ArrowRight: "star-arrows",
    Space: "coin-spacebar",
    KeyA: "resin-coin", KeyS: "resin-coin", KeyD: "resin-coin", KeyF: "resin-coin",
  };
  const quantities = cartQuantities(placed, [heart, arrows, space, coin]);
  assert.deepEqual(Object.fromEntries(quantities), { 1: 2, 69: 1, 21: 1, 2: 2 });
});

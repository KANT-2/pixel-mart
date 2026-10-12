import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/keycapFit.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { placeKeycap, removeKeycap, keycapImage, matchKeycaps, recommendKeycaps, trayKeycaps, withObject, withAnd } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const heart = { id: "resin-heart", name: "HP 하트 키캡", productId: 1, kind: "one", material: "resin", color: "#ad1d1d" };
const space = { id: "coin-spacebar", name: "골드 코인 스페이스바 키캡", productId: 21, kind: "space", material: "opaque", color: "#d6aa44" };
const arrows = { id: "star-arrows", name: "노란 별 방향키 세트", productId: 69, kind: "set", material: "opaque", color: "#ddb127" };
const shield = { id: "resin-shield", name: "푸른 방패 아티산 키캡", productId: 51, kind: "one", material: "resin", color: "#193db0" };
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

test("어울림 — 검은 키캡에 빨간 하트는 포인트가 또렷, 색이 많으면 통일감이 낮다", () => {
  const ctx = { baseColor: "#2a2733", baseLabel: "블랙 키캡", lightColor: null, lightLabel: "끔" };
  assert.equal(matchKeycaps([], ctx), null);
  const one = matchKeycaps([heart], ctx);
  assert.equal(one.unity, 100);
  assert.ok(one.point >= 50, `검은 키캡 위 빨간 하트는 포인트가 보여야 함: ${one.point}`);
  const dark = matchKeycaps([{ ...heart, color: "#2c2935" }], ctx);
  assert.ok(dark.point < 30); // 기본 키캡과 거의 같은 색은 잘 안 보임
  const many = matchKeycaps([heart, space, shield], ctx);
  assert.ok(many.unity < one.unity);
  assert.match(many.hints[1].text, /3가지/);
  assert.match(one.hints[2].text, /레진/); // 조명 꺼짐 + 레진 → 조명 안내
});

test("서랍 — 보던 키캡이 맨 앞, 이름 검색은 띄어쓰기 무시", () => {
  const all = [space, shield, heart, arrows];
  assert.deepEqual(trayKeycaps(all, "resin-heart", "all", "").map((i) => i.id), ["resin-heart", "coin-spacebar", "resin-shield", "star-arrows"]);
  assert.deepEqual(trayKeycaps(all, "resin-heart", "all", "방패아티산").map((i) => i.id), ["resin-shield"]);
  assert.deepEqual(trayKeycaps(all, null, "space", "").map((i) => i.id), ["coin-spacebar"]);
});

test("추천은 이미 끼운 키캡을 빼고 3개", () => {
  const recs = recommendKeycaps([heart, space, shield, arrows], ["resin-heart"], "#2a2733", "#ad1d1d");
  assert.equal(recs.length, 3);
  assert.ok(!recs.some((i) => i.id === "resin-heart"));
});

test("조사 — 받침 있으면 을, 없으면 를", () => {
  assert.equal(withObject("HP 하트 키캡"), "HP 하트 키캡을");
  assert.equal(withObject("노란 별 방향키 세트"), "노란 별 방향키 세트를");
});

test("RGB 조명 — 레진 키캡은 조명 궁합이 높다", () => {
  const ctx = { baseColor: "#1e1c26", baseLabel: "검은 몸체", lightColor: "rgb", lightLabel: "RGB" };
  assert.ok(matchKeycaps([heart], ctx).lightFit > matchKeycaps([space], ctx).lightFit);
  assert.match(matchKeycaps([heart], ctx).hints[2].text, /RGB/);
  assert.equal(withAnd("검은 몸체"), "검은 몸체와");
  assert.equal(withAnd("블랙 키캡"), "블랙 키캡과");
});

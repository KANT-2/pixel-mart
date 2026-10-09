import type { ApiRegion, TradeCondition, TradeInput, TradeKind, TradeMethod, TradeProximity } from "@/types/api";
import { regionPath } from "@/utils/local";

export const TRADE_KINDS: { value: TradeKind; label: string }[] = [
  { value: "have", label: "가진 물건 HAVE" }, { value: "want", label: "위시 WISH" }, { value: "sell", label: "판매 SELL" },
];
export const TRADE_CONDITIONS: { value: TradeCondition; label: string }[] = [
  { value: "new", label: "새 상품" }, { value: "like_new", label: "거의 새 상품" }, { value: "used", label: "사용감 있음" },
];
export const TRADE_METHODS: { value: TradeMethod; label: string }[] = [
  { value: "direct", label: "직접 교환·거래" }, { value: "delivery", label: "택배" }, { value: "both", label: "직접 거래·택배 모두" },
];
export const TRADE_STATUSES = { open: "진행 중", done: "완료", hidden: "숨김" };

const contactPatterns = [
  /(?:^|[^\d])0(?:1[016789]|2|[3-6]\d|70|80)[\s.-]*\d{3,4}[\s.-]*\d{4}(?!\d)/u,
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/iu,
  /(?:open|pf)\.kakao\.com|kakao(?:talk)?:\/\//iu,
  /(?:카톡|카카오톡|오픈\s*채팅|오픈톡)\s*(?:아이디|id|링크|주소|계정|[:：=]|https?:\/\/|[a-z0-9_])/iu,
  /(?:아이디|id|링크)\s*[:：=]?\s*(?:카톡|카카오톡|오픈\s*채팅)/iu,
];
export function containsContact(...values: string[]): boolean {
  return values.some((value) => contactPatterns.some((pattern) => pattern.test(value.normalize("NFKC"))));
}

export function parseTradePrice(raw: string): { value: number | null; error: string | null } {
  const text = raw.trim();
  if (!text) return { value: null, error: null };
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > 10_000_000) {
    return { value: null, error: "희망 가격은 0~10,000,000원의 정수로 입력해 주세요. 숫자만 사용할 수 있어요." };
  }
  return { value: Number(text), error: null };
}

export interface TradeDraft { kind: TradeKind; itemName: string; condition: TradeCondition | ""; price: string; tradeMethod: TradeMethod; content: string; productId: number | null; interestId: number | null; }
export function validateTrade(draft: TradeDraft) {
  const errors: Partial<Record<"itemName" | "condition" | "price" | "content" | "kind" | "tradeMethod", string>> = {};
  const itemName = draft.itemName.trim(), content = draft.content.trim();
  if (!itemName || [...itemName].length > 60) errors.itemName = "물건명은 1~60자로 입력해 주세요.";
  if ([...content].length > 1000) errors.content = "내용은 1,000자까지 입력할 수 있어요.";
  if (containsContact(itemName)) errors.itemName = "연락처는 적을 수 없어요";
  if (containsContact(content)) errors.content = "연락처는 적을 수 없어요";
  if (!TRADE_KINDS.some((item) => item.value === draft.kind)) errors.kind = "글 종류를 선택해 주세요.";
  if (!TRADE_METHODS.some((item) => item.value === draft.tradeMethod)) errors.tradeMethod = "거래 방식을 선택해 주세요.";
  if ((draft.kind === "have" || draft.kind === "sell") && !draft.condition) errors.condition = "가진 물건·판매 글은 상품 상태를 골라 주세요.";
  if (draft.condition && !TRADE_CONDITIONS.some((item) => item.value === draft.condition)) errors.condition = "상품 상태를 다시 선택해 주세요.";
  const price = parseTradePrice(draft.price);
  if (price.error) errors.price = price.error;
  const values: TradeInput = { kind: draft.kind, itemName, condition: draft.condition || null, price: price.value, tradeMethod: draft.tradeMethod, content, productId: draft.productId, interestId: draft.interestId };
  return { values, errors, valid: Object.keys(errors).length === 0 };
}

/** q: 사거나 팔고 싶은 물건 이름 (물건 이름·연결 상품·설명에서 찾음) */
export interface TradeQuery { region: string | null; hasRegion: boolean; kind?: TradeKind; q?: string; nickname?: string; productId?: number; interestId?: number; page: number; }
function positive(value: string | null): number | undefined { return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined; }
export function parseTradeQuery(params: { get(key: string): string | null }): TradeQuery {
  const region = params.get("region"), kind = params.get("kind");
  return { region: region && region.length <= 12 ? region : null, hasRegion: region !== null,
    kind: TRADE_KINDS.find((item) => item.value === kind)?.value, q: params.get("q")?.trim().slice(0, 40) || undefined, nickname: params.get("nickname")?.trim().slice(0, 30) || undefined, productId: positive(params.get("productId")), interestId: positive(params.get("interestId")), page: positive(params.get("page")) ?? 1 };
}
export function tradeQueryParams(query: TradeQuery) {
  const params = new URLSearchParams();
  if (query.hasRegion) params.set("region", query.region ?? "");
  if (query.kind) params.set("kind", query.kind);
  if (query.q) params.set("q", query.q);
  if (query.nickname) params.set("nickname", query.nickname);
  if (query.productId) params.set("productId", String(query.productId));
  if (query.interestId) params.set("interestId", String(query.interestId));
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}
export function tradeHref(query: TradeQuery): string { const search = tradeQueryParams(query).toString(); return `/local/trades${search ? `?${search}` : ""}`; }
export function changeTradeQuery(query: TradeQuery, patch: Partial<TradeQuery>): TradeQuery { return { ...query, ...patch, page: 1 }; }

export function proximityLabel(proximity: TradeProximity | null): string | null {
  return proximity === "same_zone" ? "같은 생활권" : proximity === "same_district" ? "같은 구" : null;
}
export function matchLabels(proximity: TradeProximity, mutual: boolean): string[] {
  return [...(mutual ? ["서로 원하는 교환"] : []), proximityLabel(proximity)!];
}
export function tradeProximity(regions: ApiRegion[], own: string | null, other: string): TradeProximity | null {
  if (!own) return null;
  const home = regionPath(regions, own), there = regionPath(regions, other);
  if (own === other && home.at(-1)?.level === "zone") return "same_zone";
  const district = home.find((region) => region.level === "sigungu");
  return district && there.some((region) => region.code === district.code) ? "same_district" : null;
}

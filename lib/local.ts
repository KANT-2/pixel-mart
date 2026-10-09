import { api } from "@/lib/api";
import type { ApiFandom, ApiFandomRank, ApiInterest, ApiLocalProfile, ApiMapAvatars, ApiRegion, FandomPeriod, InterestType, LocalProfileInput } from "@/types/api";
import type { ApiProduct, ApiTradePost, ApiTradeMatch, ApiWishMapItem, Page, TradeInput } from "@/types/api";
import type { TradeQuery } from "@/utils/localTrades";

const options = (signal?: AbortSignal): RequestInit => ({
  cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
});
function query(values: Record<string, string | number | undefined>) {
  return new URLSearchParams(Object.entries(values).flatMap(([key, value]) => value === undefined ? [] : [[key, String(value)]])).toString();
}

export const localApi = {
  regions: (parent?: string, signal?: AbortSignal) => api.get<ApiRegion[]>(`/regions?${query({ parent })}`, options(signal)),
  interests: (q = "", type?: InterestType, signal?: AbortSignal) => api.get<ApiInterest[]>(`/interests?${query({ q: q.trim().slice(0, 30) || undefined, type })}`, options(signal)),
  profile: (signal?: AbortSignal) => api.get<ApiLocalProfile>("/users/me/local", options(signal)),
  save: (input: LocalProfileInput, signal?: AbortSignal) => api.put<ApiLocalProfile>("/users/me/local", input, options(signal)),
  fandom: (region: string, period: FandomPeriod, interest?: number, signal?: AbortSignal) =>
    api.get<ApiFandom[]>(`/local/fandom?${query({ region, period, interest, limit: 200 })}`, options(signal)),
  fandomByInterest: (interest: number, period: FandomPeriod, signal?: AbortSignal) =>
    api.get<ApiFandom[]>(`/local/fandom?${query({ interest, period, limit: 200 })}`, options(signal)),
  mapAvatars: (region: string, interest?: number, signal?: AbortSignal) =>
    api.get<ApiMapAvatars[]>(`/local/map-avatars?${query({ region: region || undefined, interest })}`, options(signal)),
  ranking: (region: string, period: FandomPeriod, signal?: AbortSignal) =>
    api.get<ApiFandomRank[]>(`/local/fandom/ranking?${query({ region, period, limit: 10 })}`, options(signal)),
  trades: (filters: TradeQuery, signal?: AbortSignal) => api.get<Page<ApiTradePost>>(`/local/trades?${query({ region: filters.region || undefined, kind: filters.kind, productId: filters.productId, interestId: filters.interestId, page: filters.page, size: 12 })}`, options(signal)),
  myTrades: (signal?: AbortSignal) => api.get<ApiTradePost[]>("/local/trades/mine", options(signal)),
  createTrade: (input: TradeInput, signal?: AbortSignal) => api.post<ApiTradePost>("/local/trades", input, options(signal)),
  tradeStatus: (id: number, status: "done" | "hidden", signal?: AbortSignal) => api.patch<ApiTradePost>(`/local/trades/${id}`, { status }, options(signal)),
  matches: (signal?: AbortSignal) => api.get<ApiTradeMatch[]>("/local/trades/matches", options(signal)),
  wishMap: (region: string, signal?: AbortSignal) => api.get<ApiWishMapItem[]>(`/local/wish-map?${query({ region, limit: 10 })}`, options(signal)),
  searchProducts: (q: string, signal?: AbortSignal) => api.get<Page<ApiProduct>>(`/products?${query({ q: [...q.trim()].slice(0, 50).join(""), page: 1, size: 6 })}`, options(signal)),
};

export async function loadRegionCatalog(signal: AbortSignal): Promise<ApiRegion[]> {
  // 단일 지역 조회 API가 없어 단계별 목록을 모아 저장 지역과 공유 URL의 부모를 복원합니다.
  const cities = await localApi.regions(undefined, signal);
  const districts = (await Promise.all(cities.map((city) => localApi.regions(city.code, signal)))).flat();
  const zones = (await Promise.all(districts.map((district) => localApi.regions(district.code, signal)))).flat();
  return [...cities, ...districts, ...zones];
}

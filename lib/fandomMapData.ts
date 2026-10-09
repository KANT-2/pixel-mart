import { localApi } from "@/lib/local";
import { pinCount } from "@/utils/localMap";
import type { ApiFandom, ApiFandomRank, ApiMapAvatars } from "@/types/api";

export interface MapBlockData {
  code: string;
  /** 이름표 인원 — 아바타 동의자 수 또는 취향 집계(5명 미만은 null) */
  count: number | null;
  /** 아바타 PNG data URL / null(기본 슬라임) */
  pins: (string | null)[];
  sample: boolean;
  /** true면 핀이 '지도에 내 아바타 표시'에 동의한 실제 이웃 */
  real: boolean;
  /** 전체 모드에서 이 지역 1위 취향 */
  topInterest: string | null;
}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

/** 같은 요청은 60초 동안 재사용 (지도 이동·뒤로 가기 때 깜빡임 없이) */
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

/** 동시에 최대 limit개만 요청 */
async function mapLimited<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * 지도 블록 데이터 — 동의한 이웃이 5명 이상이면 실제 아바타, 아니면 취향 집계로 기본 슬라임 핀을 채운다 (정책 4.2).
 * 좌표·개인 정보는 다루지 않는다.
 */
export async function loadMapBlocks(viewCode: string, legend: string[], interest: number | null, signal: AbortSignal): Promise<MapBlockData[]> {
  const key = `${viewCode}|${interest ?? "all"}`;
  // 캐시는 여러 화면이 함께 쓰므로 한 화면의 취소 신호를 넘기지 않는다 (요청 자체에는 8초 제한이 있다)
  const avatars = await cached(`avatars|${key}`, () => localApi.mapAvatars(viewCode, interest ?? undefined))
    .catch(() => [] as ApiMapAvatars[]); // 아바타를 못 불러와도 집계 핀으로 지도는 보여 준다
  const avatarBy = new Map(avatars.map((row) => [row.regionCode, row]));

  let counts: Map<string, { count: number | null; sample: boolean; top: string | null }>;
  if (interest !== null) {
    const rows = await cached(`fandom|${interest}`, () => localApi.fandomByInterest(interest, "all"));
    counts = new Map((rows as ApiFandom[]).map((row) => [row.regionCode, { count: row.count, sample: row.isSample, top: row.interest }]));
  } else {
    const ranks = await mapLimited(legend, 4, (code) => cached(`rank|${code}`, () => localApi.ranking(code, "all")));
    counts = new Map(legend.map((code, i) => {
      const top = (ranks[i] as ApiFandomRank[])[0];
      return [code, { count: top?.count ?? null, sample: top?.isSample ?? false, top: top?.interest ?? null }];
    }));
  }

  signal.throwIfAborted();
  return legend.map((code) => {
    const real = avatarBy.get(code);
    const fallback = counts.get(code);
    if (real && !real.belowThreshold && real.avatars.length) {
      return { code, count: real.count, pins: real.avatars, sample: false, real: true, topInterest: fallback?.top ?? null };
    }
    const count = fallback?.count ?? null;
    return { code, count: count && count >= 5 ? count : null, pins: Array(pinCount(count)).fill(null), sample: fallback?.sample ?? false, real: false, topInterest: fallback?.top ?? null };
  });
}

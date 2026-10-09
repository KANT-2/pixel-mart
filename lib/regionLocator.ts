import { REGION_CENTERS } from "@/lib/localMapData";
import { nearestZone } from "@/utils/localMap";
import type { ApiRegion } from "@/types/api";

export function createRegionLocator() {
  let state = { busy: false, denied: false, message: "" }, active = false, generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: typeof state) => { state = next; listeners.forEach((listener) => listener()); };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { active = true; },
    stop() { active = false; generation++; publish({ ...state, busy: false, message: state.denied ? state.message : "" }); },
    locate(regions: ApiRegion[], onFound: (code: string) => void, geolocation: Pick<Geolocation, "getCurrentPosition"> | null) {
      if (!active || state.busy || state.denied) return;
      if (!geolocation) { publish({ ...state, message: "이 브라우저는 위치 찾기를 지원하지 않아요. 지역을 직접 선택해 주세요." }); return; }
      const token = ++generation, current = () => active && token === generation;
      publish({ busy: true, denied: false, message: "가까운 생활권을 찾고 있어요…" });
      const fail = (code: number) => {
        if (!current()) return;
        publish({ busy: false, denied: code === 1, message: code === 1 ? "위치 권한을 허용하지 않았어요. 이 화면에서는 다시 요청하지 않아요. 지역을 직접 선택해 주세요."
          : code === 3 ? "위치 찾기 시간이 초과됐어요. 지역을 직접 선택하거나 다시 시도해 주세요." : "위치를 찾지 못했어요. 지역을 직접 선택하거나 다시 시도해 주세요." });
      };
      try {
        geolocation.getCurrentPosition((position) => {
          if (!current()) return;
          // 좌표·정확도를 상태에 보관하지 않고 콜백 안에서 지역 코드로만 바꿉니다.
          const code = nearestZone(position.coords.latitude, position.coords.longitude, REGION_CENTERS);
          publish({ busy: false, denied: false, message: code ? `찾았어요: ${regions.find((region) => region.code === code)?.fullName ?? code}. 직접 선택으로 수정할 수 있어요.` : "서비스 지역 밖이에요. 가까운 생활권이 15km 안에 없어요. 지역을 직접 선택해 주세요." });
          if (code) onFound(code);
        }, (error) => fail(error.code), { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 });
      } catch { fail(2); }
    },
  };
}

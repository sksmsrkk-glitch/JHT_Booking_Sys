export const ROUTE_REFRESH_EVENT = "jht:route-refresh";

/** 저장 후 전체 문서를 다시 받지 않고 현재 App Router 데이터만 갱신하도록 요청합니다. */
export function requestRouteRefresh() {
  window.dispatchEvent(new Event(ROUTE_REFRESH_EVENT));
}

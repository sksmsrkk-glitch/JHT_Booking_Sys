/**
 * @file 한글 책임: `route refresh` 브라우저에서 공통으로 사용하는 요청·탐색 보조 동작을 제공합니다.
 * 네트워크 실패와 세션 만료를 예측 가능한 결과로 정규화해 각 폼이 로딩 상태를 반드시 해제할 수 있도록 합니다.
 */
export const ROUTE_REFRESH_EVENT = "jht:route-refresh";

/** 저장 후 전체 문서를 다시 받지 않고 현재 App Router 데이터만 갱신하도록 요청합니다. */
export function requestRouteRefresh() {
  window.dispatchEvent(new Event(ROUTE_REFRESH_EVENT));
}

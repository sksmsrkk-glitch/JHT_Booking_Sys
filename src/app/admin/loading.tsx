/**
 * @file 한글 책임: Next.js App Router의 `/admin` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import { RouteLoadingShell } from "@/components/RouteLoadingShell";

export default function AdminLoading() {
  return <RouteLoadingShell label="Loading operation admin" />;
}

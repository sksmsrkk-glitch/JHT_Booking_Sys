/**
 * @file 한글 책임: `Route Refresh Bridge` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTE_REFRESH_EVENT } from "@/lib/client/route-refresh";

export function RouteRefreshBridge() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(ROUTE_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(ROUTE_REFRESH_EVENT, refresh);
  }, [router]);

  return null;
}

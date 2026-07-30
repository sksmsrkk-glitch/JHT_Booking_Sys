/**
 * @file 한글 책임: Next.js App Router의 `/admin` 화면 전체에 적용되는 내부 포털 접근 가드입니다.
 * 내부 역할이 없는 세션이 들어오면 패널마다 "Internal role is required" 오류가 흩어져 보이는 대신,
 * 렌더 전에 한 번만 판정해 내부 로그인 화면으로 안내합니다.
 */
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { HttpError } from "@/lib/api/http";
import { getInternalPageContext } from "@/lib/api/server-page-context";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  // x-jht-path는 미들웨어가 항상 실제 경로로 덮어쓰므로 클라이언트가 위조할 수 없습니다.
  const path = headerStore.get("x-jht-path") ?? "";
  if (path === "/admin/bootstrap" || isDemoModeEnabled()) {
    return <>{children}</>;
  }

  try {
    // React cache() 덕분에 이 검사 결과는 같은 요청의 페이지 렌더에서 재사용됩니다.
    await getInternalPageContext();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect(`/auth/login?next=${encodeURIComponent(path || "/admin")}`);
    }
    if (error instanceof HttpError && error.status === 403) {
      // 로그인은 되어 있지만 내부 역할이 없는 계정(예: 파트너 계정)입니다.
      redirect("/auth/login?reason=internal-role");
    }
    throw error;
  }

  return <>{children}</>;
}

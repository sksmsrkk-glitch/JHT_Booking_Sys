/**
 * @file 한글 책임: Next.js App Router의 `/agency` 화면 또는 라우트 레이아웃을 구성합니다.
 * 해외 파트너에게 허용된 데이터만 준비하고, 파트너 계정이 아닌 세션이 보호 화면에 들어오면
 * 패널마다 오류가 흩어져 보이는 대신 렌더 전에 한 번만 판정해 파트너 로그인으로 안내합니다.
 */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PartnerWorkspaceShell } from "@/components/agency/PartnerWorkspaceShell";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { HttpError } from "@/lib/api/http";
import { getPageAuthorization } from "@/lib/api/page-session";
import { getAgencyPageContext } from "@/lib/api/server-page-context";

const PUBLIC_AGENCY_PATHS = new Set([
  "/agency",
  "/agency/login",
  "/agency/signup",
  "/agency/forgot-email",
  "/agency/forgot-password",
  "/agency/reset-password"
]);

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const { authorization, headerStore } = await getPageAuthorization();
  // x-jht-path는 미들웨어가 항상 실제 경로로 덮어쓰므로 클라이언트가 위조할 수 없습니다.
  const path = headerStore.get("x-jht-path") ?? "";
  const isProtectedPath = path.startsWith("/agency") && !PUBLIC_AGENCY_PATHS.has(path);

  if (authorization && isProtectedPath && !isDemoModeEnabled()) {
    try {
      // React cache() 덕분에 이 검사 결과는 같은 요청의 페이지 렌더에서 재사용됩니다.
      await getAgencyPageContext();
    } catch (error) {
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
        // 로그인은 되어 있지만 활성 파트너 계정이 아닌 세션(예: 내부 직원 계정)입니다.
        redirect("/agency/login?reason=agency-account");
      }
      throw error;
    }
  }

  return <PartnerWorkspaceShell isAuthenticated={Boolean(authorization)}>{children}</PartnerWorkspaceShell>;
}

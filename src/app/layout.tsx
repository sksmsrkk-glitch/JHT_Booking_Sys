/**
 * @file 한글 책임: Next.js App Router의 `/` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { AdminShellFrame } from "@/components/AdminShellFrame";
import { AppTopbar } from "@/components/AppTopbar";
import { CalendarLocaleEnforcer } from "@/components/CalendarLocaleEnforcer";
import { RouteRefreshBridge } from "@/components/RouteRefreshBridge";
import { normalizeSessionSurface, sessionCookieNames } from "@/lib/domain/auth-session.mjs";
import { normalizeLocale } from "@/lib/i18n";
// 한글 서체는 사용자 PC 설치 여부에 의존하지 않도록 Pretendard Variable을 self-host합니다.
// dynamic subset이라 실제 화면에 쓰인 글리프 조각만 내려받고, 외부 CDN 요청은 없습니다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

/*
 * Notion 디자인 언어의 본문 서체입니다. next/font가 빌드 시점에 자체 호스팅하므로
 * 사용자 PC에 설치되어 있지 않아도 동일하게 렌더되고, 런타임 외부 요청도 없습니다.
 * 한글은 CSS 폰트 스택의 글리프 단위 폴백으로 Pretendard 계열이 이어받습니다.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--jht-font-inter"
});

export const metadata: Metadata = {
  title: "JHT Operations Platform",
  description: "Inbound travel quotation, reservation, operations, and settlement platform"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const locale = normalizeLocale(headerStore.get("x-jht-locale") ?? cookieStore.get("jht_locale")?.value);
  // 현재 화면이 속한 포털의 세션 쿠키만 확인해, 다른 포털 로그인 상태가 이 화면의 로그인 표시를 바꾸지 않게 합니다.
  const surfaceCookies = sessionCookieNames(normalizeSessionSurface(headerStore.get("x-jht-surface")));
  const isSignedIn = Boolean(
    cookieStore.get(surfaceCookies.access)?.value || cookieStore.get(surfaceCookies.refresh)?.value
  );

  return (
    <html className={inter.variable} lang={locale}>
      <body>
        <div className="shell">
          <AppTopbar isSignedIn={isSignedIn} locale={locale} />
          <AdminShellFrame locale={locale}>{children}</AdminShellFrame>
          <RouteRefreshBridge />
          <CalendarLocaleEnforcer />
        </div>
      </body>
    </html>
  );
}

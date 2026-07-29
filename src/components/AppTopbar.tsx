/**
 * @file 한글 책임: `App Topbar` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Locale } from "@/lib/i18n";
import { commonText } from "@/lib/i18n";

type AppTopbarProps = {
  isSignedIn: boolean;
  locale: Locale;
};

/*
 * 전체 서비스의 상단 네비게이션입니다.
 * 내부 관리자(/admin 계열)와 해외 파트너 포털(/agency 계열)은 사용 목적과 노출 데이터가 다르므로
 * 현재 경로를 기준으로 메뉴를 완전히 분리합니다.
 */
export function AppTopbar({ isSignedIn, locale }: AppTopbarProps) {
  const pathname = usePathname();
  const isAgencySurface = pathname === "/agency" || pathname.startsWith("/agency/");
  // 파트너 포털은 해외 업체가 쓰는 고객 화면이므로 전역 KOR 설정과 무관하게 영문 UI만 노출합니다.
  const effectiveLocale = isAgencySurface ? "en" : locale;
  const text = commonText[effectiveLocale];
  const agencyHomeLabel = "Portal Home";
  const agencyNewInquiryLabel = "New Inquiry";
  const communicationLabel = "Communication";
  const loginLabel = isSignedIn ? text.signOut : text.signIn;
  const loginHref = (isAgencySurface ? "/agency/login" : "/auth/login") as Route;
  /*
   * 어드민 목적지는 좌측 사이드바(AdminWorkspaceSidebar)에 전부 펼쳐 두었으므로,
   * 상단바에는 파트너 포털 이동 같은 화면 전환 링크만 남깁니다.
   */
  const portalLinkLabel = text.overseasAgencyPortal;

  return (
    <header className="topbar">
      <Link
        className="brand"
        href={isAgencySurface ? ("/agency" as Route) : ("/" as Route)}
        style={{ alignItems: "center", display: "inline-flex", height: 56, overflow: "hidden", width: 100 }}
      >
        <img
          alt="Jung Ho Travel logo"
          height={52}
          src="/jht-logo.png"
          style={{ display: "block", height: "auto", maxHeight: 52, maxWidth: 92, objectFit: "contain", width: 92 }}
          width={92}
        />
      </Link>
      {isAgencySurface ? (
        <nav className="nav primary-nav agency-nav" aria-label="Overseas agency portal navigation">
          <Link href={"/agency" as Route}>{agencyHomeLabel}</Link>
          <Link href={"/agency/inquiries/new" as Route}>{agencyNewInquiryLabel}</Link>
          <Link href={"/agency/workflows" as Route}>{communicationLabel}</Link>
        </nav>
      ) : (
        <nav className="nav primary-nav" aria-label="Primary navigation">
          <Link href={"/agency" as Route}>{portalLinkLabel}</Link>
        </nav>
      )}
      <div className="topbar-controls">
        {isSignedIn ? (
          <form action="/auth/logout" className="auth-nav-form" method="post">
            <button className="auth-nav-link" type="submit">{loginLabel}</button>
          </form>
        ) : (
          <Link className="auth-nav-link" href={loginHref}>{loginLabel}</Link>
        )}
        <ThemeToggle />
        {isAgencySurface ? null : <LanguageSwitcher locale={effectiveLocale} />}
      </div>
    </header>
  );
}

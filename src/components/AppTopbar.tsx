"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNavMore } from "@/components/TopNavMore";
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
  const text = commonText[locale];
  const dashboardLabel = locale === "ko" ? "대시보드" : "Dashboard";
  const financeLabel = locale === "ko" ? "재무" : "Finance";
  const moreLabel = locale === "ko" ? "더보기" : "More";
  const agencyHomeLabel = locale === "ko" ? "포털 홈" : "Portal Home";
  const agencySignupLabel = locale === "ko" ? "파트너 등록" : "Partner Sign-up";
  const agencyNewInquiryLabel = locale === "ko" ? "신규 문의" : "New Inquiry";
  const invoiceLabel = locale === "ko" ? "인보이스" : "Invoices";
  const communicationLabel = locale === "ko" ? "소통" : "Communication";
  const loginLabel = isSignedIn ? text.signOut : text.signIn;
  const agencyAuthHref = (isSignedIn ? "/auth/logout" : "/agency/login") as Route;
  const internalAuthHref = (isSignedIn ? "/auth/logout" : "/auth/login") as Route;
  const moreItems = [
    { href: "/admin/domestic-suppliers" as Route, label: text.domesticSuppliers },
    { href: "/admin/exchange-rates" as Route, label: text.exchangeRates },
    { href: "/admin/workflows" as Route, label: "Workflows" },
    { href: "/admin/confirmations" as Route, label: "Confirmations" },
    { href: "/admin/guide-expenses" as Route, label: "Guide Expenses" },
    { href: "/agency", label: text.overseasAgencyPortal },
    { href: "/admin/users" as Route, label: "Users" },
    { href: "/admin/audit" as Route, label: "Audit" }
  ];

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
          <Link href={"/agency/quote-cases" as Route}>{text.quotes}</Link>
          <Link href={"/agency/reservations" as Route}>{text.reservations}</Link>
          <Link href={"/agency/invoices" as Route}>{invoiceLabel}</Link>
          <Link href={"/agency/workflows" as Route}>{communicationLabel}</Link>
          <Link href={"/agency/signup" as Route}>{agencySignupLabel}</Link>
        </nav>
      ) : (
        <nav className="nav primary-nav" aria-label="Primary navigation">
          <Link href="/admin">{dashboardLabel}</Link>
          <Link href={"/admin/quote-cases" as Route}>{text.quotes}</Link>
          <Link href={"/admin/reservations" as Route}>{text.reservations}</Link>
          <Link href={"/admin/finance/invoices" as Route}>{financeLabel}</Link>
          <TopNavMore items={moreItems} label={moreLabel} />
        </nav>
      )}
      <div className="topbar-controls">
        <Link className="auth-nav-link" href={isAgencySurface ? agencyAuthHref : internalAuthHref}>
          {loginLabel}
        </Link>
        <ThemeToggle />
        <LanguageSwitcher locale={locale} />
      </div>
    </header>
  );
}

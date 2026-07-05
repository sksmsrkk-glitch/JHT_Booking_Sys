import type { Metadata } from "next";
import type { Route } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import Link from "next/link";
import { GlobalTextTranslator } from "@/components/GlobalTextTranslator";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNavMore } from "@/components/TopNavMore";
import { commonText, normalizeLocale } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "JHT Operations Platform",
  description: "Inbound travel quotation, reservation, operations, and settlement platform"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const locale = normalizeLocale(headerStore.get("x-jht-locale"));
  const isSignedIn = Boolean(cookieStore.get("jht_access_token")?.value);
  const text = commonText[locale];
  const dashboardLabel = locale === "ko" ? "대시보드" : "Dashboard";
  const financeLabel = locale === "ko" ? "재무" : "Finance";
  const moreLabel = locale === "ko" ? "더보기" : "More";
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
    <html lang={locale}>
      <body>
        <div className="shell">
          <header className="topbar">
            <Link
              className="brand"
              href="/"
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
            <nav className="nav primary-nav" aria-label="Primary navigation">
              <Link href="/admin">{dashboardLabel}</Link>
              <Link href={"/admin/quote-cases" as Route}>{text.quotes}</Link>
              <Link href={"/admin/reservations" as Route}>{text.reservations}</Link>
              <Link href={"/admin/finance/invoices" as Route}>{financeLabel}</Link>
              <TopNavMore items={moreItems} label={moreLabel} />
            </nav>
            <div className="topbar-controls">
              <Link className="auth-nav-link" href={(isSignedIn ? "/auth/logout" : "/auth/login") as Route}>
                {isSignedIn ? text.signOut : text.signIn}
              </Link>
              <ThemeToggle />
              <LanguageSwitcher locale={locale} />
            </div>
          </header>
          <main className="main">{children}</main>
          <GlobalTextTranslator locale={locale} />
        </div>
      </body>
    </html>
  );
}

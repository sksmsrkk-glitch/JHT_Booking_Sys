import type { Metadata } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { AppTopbar } from "@/components/AppTopbar";
import { CalendarLocaleEnforcer } from "@/components/CalendarLocaleEnforcer";
import { GlobalTextTranslator } from "@/components/GlobalTextTranslator";
import { RouteRefreshBridge } from "@/components/RouteRefreshBridge";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/domain/auth-session.mjs";
import { normalizeLocale } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "JHT Operations Platform",
  description: "Inbound travel quotation, reservation, operations, and settlement platform"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const locale = normalizeLocale(headerStore.get("x-jht-locale") ?? cookieStore.get("jht_locale")?.value);
  const isSignedIn = Boolean(
    cookieStore.get(ACCESS_TOKEN_COOKIE)?.value || cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
  );

  return (
    <html lang={locale}>
      <body>
        <div className="shell">
          <AppTopbar isSignedIn={isSignedIn} locale={locale} />
          <main className="main">{children}</main>
          <RouteRefreshBridge />
          <CalendarLocaleEnforcer />
          <GlobalTextTranslator locale={locale} />
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { AppTopbar } from "@/components/AppTopbar";
import { GlobalTextTranslator } from "@/components/GlobalTextTranslator";
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
  const isSignedIn = Boolean(cookieStore.get("jht_access_token")?.value);

  return (
    <html lang={locale}>
      <body>
        <div className="shell">
          <AppTopbar isSignedIn={isSignedIn} locale={locale} />
          <main className="main">{children}</main>
          <GlobalTextTranslator locale={locale} />
        </div>
      </body>
    </html>
  );
}

"use client";

import type { Route } from "next";
import type { Locale } from "@/lib/i18n";
import { commonText } from "@/lib/i18n";
import { useRouter } from "next/navigation";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const text = commonText[locale];

  function switchLocale(nextLocale: Locale) {
    document.cookie = `jht_locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    router.replace(`${url.pathname}${url.search}${url.hash}` as Route);
    router.refresh();
  }

  return (
    <div className="language-switcher" aria-label={text.language}>
      <button
        aria-pressed={locale === "en"}
        className={locale === "en" ? "active" : ""}
        onClick={() => switchLocale("en")}
        type="button"
      >
        EN
      </button>
      <button
        aria-pressed={locale === "ko"}
        className={locale === "ko" ? "active" : ""}
        onClick={() => switchLocale("ko")}
        type="button"
      >
        KOR
      </button>
    </div>
  );
}

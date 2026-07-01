"use client";

import type { Locale } from "@/lib/i18n";
import { commonText } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const text = commonText[locale];

  function switchLocale(nextLocale: Locale) {
    document.cookie = `jht_locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    window.location.href = url.toString();
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

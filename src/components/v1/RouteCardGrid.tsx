/**
 * @file 한글 책임: `Route Card Grid` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
import Link from "next/link";
import type { V1RouteCard } from "@/features/v1/site-map";
import type { Locale } from "@/lib/i18n";
import { commonText, routeText } from "@/lib/i18n";

export function RouteCardGrid({
  routes,
  density = "standard",
  locale = "en"
}: {
  routes: V1RouteCard[];
  density?: "standard" | "compact";
  locale?: Locale;
}) {
  const common = commonText[locale];

  return (
    <section className={`route-grid route-grid-${density}`}>
      {routes.map((route) => {
        const translated = locale === "ko" ? routeText[route.title]?.ko : null;
        const title = translated?.title ?? route.title;
        const description = translated?.description ?? route.description;
        const owner = translated?.owner ?? route.owner;

        return (
          <Link className={`route-card route-card-${density}`} href={route.href} key={route.title}>
            <div className="split-row">
              <h2>{title}</h2>
              <span className={`status-dot status-${route.status}`}>{formatStatusLabel(route.status, locale)}</span>
            </div>
            {density === "standard" ? <p>{description}</p> : null}
            <span className="subtext">{density === "standard" ? `${common.owner}: ${owner}` : owner}</span>
          </Link>
        );
      })}
    </section>
  );
}

function formatStatusLabel(value: string, locale: Locale) {
  if (value === "live") return commonText[locale].live;
  if (value === "ready") return commonText[locale].ready;
  if (value === "next") return commonText[locale].next;
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

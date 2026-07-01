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

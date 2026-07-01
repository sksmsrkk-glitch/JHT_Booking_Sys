import { cookies } from "next/headers";
import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import { adminRoutes, agencyRoutes } from "@/features/v1/site-map";
import { normalizeLocale } from "@/lib/i18n";

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("jht_locale")?.value);
  const primaryTitles = ["Quote Cases", "Reservations", "Domestic Suppliers", "Overseas Agencies"];
  const primaryAdminRoutes = primaryTitles
    .map((title) => adminRoutes.find((route) => route.title === title))
    .filter((route): route is (typeof adminRoutes)[number] => Boolean(route));

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">JHT Booking Engine</p>
          <h1>{locale === "ko" ? "정호여행사 운영 플랫폼" : "Jungho Travel Operations Platform"}</h1>
          <p>
            {locale === "ko"
              ? "인바운드 여행의 견적, 예약, 오퍼레이션, 인보이스, 정산을 하나의 업무 공간에서 관리합니다."
              : "Quote, book, operate, invoice, and settle inbound travel programs in one controlled workspace."}
          </p>
        </div>
      </div>
      <section className="section-block">
        <div className="section-heading">
          <h2>{locale === "ko" ? "내부 업무 메뉴" : "Internal Workbench"}</h2>
          <span>{locale === "ko" ? "핵심 흐름" : "Core flow"}</span>
        </div>
        <RouteCardGrid locale={locale} routes={primaryAdminRoutes} />
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>{locale === "ko" ? "해외 파트너 포털" : "Overseas Agency Portal"}</h2>
          <span>{locale === "ko" ? `${agencyRoutes.length}개 메뉴` : `${agencyRoutes.length} workspaces`}</span>
        </div>
        <RouteCardGrid density="compact" locale={locale} routes={agencyRoutes} />
      </section>
    </>
  );
}

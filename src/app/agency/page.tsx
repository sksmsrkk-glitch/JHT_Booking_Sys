import { cookies } from "next/headers";
import type { Route } from "next";
import Link from "next/link";
import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import { agencyRoutes } from "@/features/v1/site-map";
import { normalizeLocale } from "@/lib/i18n";

export default async function AgencyPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("jht_locale")?.value);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">{locale === "ko" ? "파트너 포털" : "Customer Portal"}</p>
          <h1>{locale === "ko" ? "해외 파트너 포털" : "Overseas Agency Portal"}</h1>
          <p>
            {locale === "ko"
              ? "해외 파트너사가 문의를 생성하고, 공개 견적을 확인하고, 예약 요청과 룸링 리스트 업로드 및 인보이스 확인을 할 수 있는 포털입니다."
              : "Portal for foreign agency customers to create inquiries, review safe quote summaries, request bookings, upload rooming lists, and check invoices."}
          </p>
        </div>
      </div>
      <section className="notice">
        <h2>{locale === "ko" ? "파트너 공개 화면" : "Customer-safe view"}</h2>
        <p>
          {locale === "ko"
            ? "국내 공급사 원가, 마진, 내부 오퍼레이션 업무, 공급사 메시지, 비용, 쇼핑 커미션, 정산 정보는 의도적으로 숨겨집니다."
            : "Domestic supplier costs, margins, internal operation tasks, supplier message outbox, expenses, shopping commissions, and settlements are intentionally hidden."}
        </p>
      </section>
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Partner Access Application</h2>
            <p>New overseas partners must apply first. JHT admin approval creates the mother ID.</p>
          </div>
          <Link className="button-primary" href={"/agency/signup" as Route}>
            Apply
          </Link>
        </div>
      </section>
      <RouteCardGrid locale={locale} routes={agencyRoutes} />
    </>
  );
}

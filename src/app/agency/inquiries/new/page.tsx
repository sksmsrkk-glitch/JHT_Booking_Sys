/**
 * @file 한글 책임: Next.js App Router의 `/agency/inquiries/new` 화면 또는 라우트 레이아웃을 구성합니다.
 * 해외 파트너에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { InquiryCreateForm } from "@/components/agency/InquiryCreateForm";
import { isDemoModeEnabled } from "@/lib/api/guards";

export const dynamic = "force-dynamic";

const inquiriesRoute = "/agency/inquiries" as Route;

export default async function AgencyNewInquiryPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>New Inquiry</h1>
          <p>Create a new agency-scoped inquiry without exposing internal cost or supplier data.</p>
        </div>
        <Link className="button-secondary" href={inquiriesRoute}>
          Back to Inquiries
        </Link>
      </div>

      {isDemoModeEnabled() ? (
        <section className="notice">
          <h2>Development preview mode</h2>
          <p>Agency login is bypassed only because JHT_DEMO_MODE is enabled in this local environment.</p>
        </section>
      ) : null}

      <InquiryCreateForm />

      <section className="notice">
        <h2>Inquiry boundary</h2>
        <ul className="clean-list">
          <li>New inquiries are created only for the signed-in agency account.</li>
          <li>Booking and revision requests remain separate audited actions on quote detail pages.</li>
          <li>Domestic Supplier costs, quote items, and internal finance records are not queried here.</li>
        </ul>
      </section>
    </>
  );
}

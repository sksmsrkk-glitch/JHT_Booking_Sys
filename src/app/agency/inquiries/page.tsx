/**
 * @file 한글 책임: Next.js App Router의 `/agency/inquiries` 화면 또는 라우트 레이아웃을 구성합니다.
 * 해외 파트너에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { listAgencyInquiryPage } from "@/features/agency-portal/queries";
import type { AgencyInquirySummary } from "@/features/agency/types";
import { InquiryCreateForm } from "@/components/agency/InquiryCreateForm";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, parsePagination, type PaginationMeta } from "@/lib/api/pagination";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { classifyPageDataError, getAgencyPageContext } from "@/lib/api/server-page-context";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; inquiries: AgencyInquirySummary[]; pagination: PaginationMeta; isPreview?: boolean }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;
type SearchParams = Promise<{ page?: string; pageSize?: string }>;

export default async function AgencyInquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const loadState = await loadInquiries(params);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Inquiries</h1>
          <p>
            Create and track agency-owned inquiries, revision requests, booking requests,
            changes, and cancellations through agency-scoped RLS.
          </p>
        </div>
        <Link className="button-secondary" href={agencyRoute}>
          Back to Portal
        </Link>
      </div>

      <section className="action-band">
        <div>
          <h2>New Inquiry</h2>
          <p>Use the dedicated form page when you want a focused inquiry submission workflow.</p>
        </div>
        <Link className="button-primary" href={"/agency/inquiries/new" as Route}>
          Create Inquiry
        </Link>
      </section>

      <InquiryCreateForm />

      {loadState.status === "ready" && loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Agency login is bypassed during development, so this list shows sample inquiry workflow rows.</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Inquiries could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Partner session required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <>
          <InquiryDatabase inquiries={loadState.inquiries} pagination={loadState.pagination} />
          <PaginationControls action="/agency/inquiries" pagination={loadState.pagination} />
        </>
      ) : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Agency users can read and create inquiries only for their own agency account.</li>
          <li>Booking requests do not grant direct reservation write access.</li>
          <li>Domestic Supplier prices, quote items, operation tasks, and settlements are not queried here.</li>
        </ul>
      </section>
    </>
  );
}

function InquiryDatabase({ inquiries, pagination }: { inquiries: AgencyInquirySummary[]; pagination: PaginationMeta }) {
  if (inquiries.length === 0) {
    return (
      <section className="empty-state">
        <h2>No inquiries yet</h2>
        <p>New inquiries and booking requests will appear here after submission.</p>
      </section>
    );
  }

  const revisionCount = inquiries.filter((inquiry) => inquiry.inquiryType !== "new_inquiry").length;
  const paxCount = inquiries.reduce((total, inquiry) => total + (inquiry.paxCount ?? 0), 0);

  return (
    <section className="partner-database-shell" aria-label="Agency inquiries">
      <div className="partner-database-toolbar">
        <div>
          <p className="eyebrow">Inquiry Database</p>
          <h2>Partner request ledger</h2>
        </div>
        <div className="partner-view-tabs" aria-label="Inquiry views">
          <span className="active">Table</span>
          <span>By Type</span>
          <span>Recent</span>
        </div>
      </div>

      <div className="partner-database-metrics" aria-label="Inquiry metrics">
        <div>
          <span>Requests</span>
          <strong>{pagination.total}</strong>
        </div>
        <div>
          <span>Revision or booking</span>
          <strong>{revisionCount}</strong>
        </div>
        <div>
          <span>Total pax</span>
          <strong>{paxCount || "-"}</strong>
        </div>
      </div>

      <div className="partner-database-grid partner-inquiries-grid">
        <div className="partner-database-header" role="row">
          <span>Tour Code</span>
          <span>Title</span>
          <span>Type</span>
          <span>Submitted</span>
          <span>Period</span>
          <span>Pax</span>
          <span>Status</span>
        </div>

        {inquiries.map((inquiry) => (
          <article className="partner-database-row" key={inquiry.id}>
            <div className="partner-database-title">
              <small>Tour Code</small>
              <strong>{(inquiry as any).tourCode ?? "-"}</strong>
            </div>
            <div className="partner-property">
              <small>Title</small>
              <strong>{inquiry.title}</strong>
              <span>{inquiry.tourType ? formatLabel(inquiry.tourType) : "Tour type not set"}</span>
            </div>
            <div className="partner-property">
              <small>Type</small>
              <strong>{formatLabel(inquiry.inquiryType)}</strong>
            </div>
            <div className="partner-property">
              <small>Submitted</small>
              <strong>{inquiry.createdAt.slice(0, 10)}</strong>
            </div>
            <div className="partner-property">
              <small>Period</small>
              <strong>{(inquiry as any).periodText ?? formatDateRange(inquiry.requestedStartDate, inquiry.requestedEndDate)}</strong>
            </div>
            <div className="partner-property">
              <small>Pax</small>
              <strong>{inquiry.paxCount ?? "Not set"}</strong>
            </div>
            <div className="partner-property">
              <small>Status</small>
              <span className={`status-dot status-${inquiry.status}`}>{formatLabel(inquiry.status)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

async function loadInquiries(params: { page?: string; pageSize?: string }): Promise<LoadState> {
  try {
    const { supabase, user } = await getAgencyPageContext();
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page);
    if (params.pageSize) searchParams.set("pageSize", params.pageSize);
    const page = await listAgencyInquiryPage(supabase, user.agencyAccountId, parsePagination(searchParams));
    return { status: "ready", inquiries: page.items, pagination: page.pagination };
  } catch (error) {
    const failure = classifyPageDataError(error);
    if (failure.status === "auth-required" && isDemoModeEnabled()) {
      return {
        status: "ready",
        inquiries: demoAgencyInquiries,
        pagination: buildPaginationMeta({ page: 1, pageSize: 20 }, demoAgencyInquiries.length, demoAgencyInquiries.length),
        isPreview: true
      };
    }
    if (failure.status === "auth-required") {
      return { status: "auth-required", message: "Log in with an approved partner account to view inquiries." };
    }
    return failure;
  }
}

const demoAgencyInquiries = [
  {
    id: "preview-inquiry-new",
    tourCode: "MY-WORLDTRAV-20260629",
    inquiryType: "new_inquiry",
    title: "MHDM Seoul 4N group",
    requestedStartDate: "2026-03-24",
    requestedEndDate: "2026-03-28",
    periodText: "24-28 Mar 2026 / 4 nights",
    paxCount: 26,
    tourType: "incentive_tour",
    status: "new",
    createdAt: "2026-06-29T09:00:00+09:00"
  },
  {
    id: "preview-inquiry-revision",
    tourCode: "MY-WORLDTRAV-20260629",
    inquiryType: "revision_request",
    title: "MHDM Seoul 4N group - hotel/date change",
    requestedStartDate: null,
    requestedEndDate: null,
    periodText: "Change from 4N to 5N, move start date to September",
    paxCount: 26,
    tourType: "incentive_tour",
    status: "reviewing",
    createdAt: "2026-06-29T10:00:00+09:00"
  }
] as any[];

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Not set";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

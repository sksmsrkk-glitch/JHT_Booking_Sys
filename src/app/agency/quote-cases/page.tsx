/**
 * @file 한글 책임: Next.js App Router의 `/agency/quote-cases` 화면 또는 라우트 레이아웃을 구성합니다.
 * 해외 파트너에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { listAgencyQuoteCasePage } from "@/features/agency-portal/queries";
import type { AgencyQuoteListItem } from "@/features/agency-portal/types";
import { QuoteRequestActions } from "@/components/agency/QuoteRequestActions";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, parsePagination, type PaginationMeta } from "@/lib/api/pagination";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { classifyPageDataError, getAgencyPageContext } from "@/lib/api/server-page-context";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; quoteCases: AgencyQuoteListItem[]; pagination: PaginationMeta; isPreview?: boolean }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;
type SearchParams = Promise<{ page?: string; pageSize?: string }>;

export default async function AgencyQuoteCasesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const loadState = await loadQuoteCases(params);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Quotes</h1>
          <p>
            Review customer-safe quote summaries, public totals, itinerary status, and
            booking/revision request entry points.
          </p>
        </div>
        <Link className="button-secondary" href={agencyRoute}>
          Back to Portal
        </Link>
      </div>

      {loadState.status === "ready" && loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Agency login is bypassed during development, so this page shows sample quote rows.</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Quotes could not load</h2>
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
          <QuoteDatabase pagination={loadState.pagination} quoteCases={loadState.quoteCases} />
          <PaginationControls action="/agency/quote-cases" pagination={loadState.pagination} />
        </>
      ) : null}

      <section className="notice">
        <h2>Customer-safe quote boundary</h2>
        <ul className="clean-list">
          <li>This view uses public quote versions only.</li>
          <li>Supplier costs, quote item internals, internal totals, and margins are not queried.</li>
          <li>Share IDs remain protected by agency membership and Supabase RLS.</li>
        </ul>
      </section>
    </>
  );
}

function QuoteDatabase({ quoteCases, pagination }: { quoteCases: AgencyQuoteListItem[]; pagination: PaginationMeta }) {
  if (quoteCases.length === 0) {
    return (
      <section className="empty-state">
        <h2>No quotes available</h2>
        <p>Sent quote versions from JHT will appear here.</p>
      </section>
    );
  }

  const visiblePax = quoteCases.reduce((total, quoteCase) => total + (quoteCase.estimatedPax ?? 0), 0);
  const publicTotal = quoteCases.reduce((total, quoteCase) => total + (quoteCase.publicTotalAmount ?? 0), 0);
  const primaryCurrency = quoteCases[0]?.currency ?? "";
  const usesOneCurrency = quoteCases.every((quoteCase) => quoteCase.currency === primaryCurrency);
  const liveQuoteCount = quoteCases.filter((quoteCase) => ["sent", "accepted"].includes(quoteCase.status)).length;

  return (
    <section className="partner-database-shell" aria-label="Agency quotes">
      <div className="partner-database-toolbar">
        <div>
          <p className="eyebrow">Quote Database</p>
          <h2>Customer-safe quote records</h2>
        </div>
        <div className="partner-view-tabs" aria-label="Quote views">
          <span className="active">Table</span>
          <span>Timeline</span>
          <span>Requests</span>
        </div>
      </div>

      <div className="partner-database-metrics" aria-label="Quote metrics">
        <div>
          <span>All quotes</span>
          <strong>{pagination.total}</strong>
        </div>
        <div>
          <span>Sent or accepted</span>
          <strong>{liveQuoteCount}</strong>
        </div>
        <div>
          <span>Total pax</span>
          <strong>{visiblePax || "-"}</strong>
        </div>
        <div>
          <span>Public total</span>
          <strong>{usesOneCurrency ? formatMoney(primaryCurrency, publicTotal) : "Mixed"}</strong>
        </div>
      </div>

      <div className="partner-database-grid partner-quotes-grid">
        <div className="partner-database-header" role="row">
          <span>Quote</span>
          <span>Status</span>
          <span>Travel Dates</span>
          <span>Pax</span>
          <span>Version</span>
          <span>Total</span>
          <span>Action</span>
        </div>

        {quoteCases.map((quoteCase) => (
          <article className="partner-database-row" key={quoteCase.id}>
            <div className="partner-database-title">
              <small>Quote</small>
              <strong>
                <Link className="strong-link" href={`/agency/quote-cases/${quoteCase.shareId}` as Route}>
                  {quoteCase.tourName}
                </Link>
              </strong>
              <span>{quoteCase.caseCode}</span>
            </div>
            <div className="partner-property">
              <small>Status</small>
              <span className={`status-dot status-${quoteCase.status}`}>{formatLabel(quoteCase.status)}</span>
            </div>
            <div className="partner-property">
              <small>Travel Dates</small>
              <strong>{formatDateRange(quoteCase.startDate, quoteCase.endDate)}</strong>
            </div>
            <div className="partner-property">
              <small>Pax</small>
              <strong>{quoteCase.estimatedPax ?? "Not set"}</strong>
            </div>
            <div className="partner-property">
              <small>Version</small>
              <strong>
                {quoteCase.latestVersionNo ? `v${quoteCase.latestVersionNo}` : "Not public"}
              </strong>
              {quoteCase.latestVersionStatus ? <span>{formatLabel(quoteCase.latestVersionStatus)}</span> : null}
            </div>
            <div className="partner-property">
              <small>Public Total</small>
              <strong>
                {quoteCase.publicTotalAmount === null
                  ? "Not set"
                  : `${quoteCase.currency} ${quoteCase.publicTotalAmount.toLocaleString("en-US")}`}
              </strong>
            </div>
            <div className="partner-database-actions">
              <QuoteRequestActions
                quoteCaseId={quoteCase.id}
                quoteCaseStatus={quoteCase.status}
                tourName={quoteCase.tourName}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

async function loadQuoteCases(params: { page?: string; pageSize?: string }): Promise<LoadState> {
  try {
    const { supabase, user } = await getAgencyPageContext();
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page);
    if (params.pageSize) searchParams.set("pageSize", params.pageSize);
    const page = await listAgencyQuoteCasePage(supabase, user.agencyAccountId, parsePagination(searchParams));
    return { status: "ready", quoteCases: page.items, pagination: page.pagination };
  } catch (error) {
    const failure = classifyPageDataError(error);
    if (failure.status === "auth-required") {
      if (!isDemoModeEnabled()) {
        return { status: "auth-required", message: "Log in with an approved partner account to review quotes." };
      }
      return {
        status: "ready",
        quoteCases: demoQuoteCases,
        pagination: buildPaginationMeta({ page: 1, pageSize: 20 }, demoQuoteCases.length, demoQuoteCases.length),
        isPreview: true
      };
    }
    return failure;
  }
}

const demoQuoteCases: AgencyQuoteListItem[] = [
  {
    id: "preview-quote-mhdm",
    caseCode: "MY-WORLDTRAV-20260629",
    shareId: "preview-quote-mhdm",
    tourName: "MHDM Seoul 4N group",
    tourType: "incentive_tour",
    status: "sent",
    currency: "MYR",
    estimatedPax: 26,
    startDate: "2026-03-24",
    endDate: "2026-03-28",
    latestVersionNo: 2,
    latestVersionStatus: "sent",
    publicTotalAmount: 183740,
    sentAt: "2026-06-29T09:30:00+09:00",
    acceptedAt: null,
    createdAt: "2026-06-29T09:00:00+09:00"
  }
];

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

function formatMoney(currency: string, amount: number) {
  if (!amount) return "-";
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

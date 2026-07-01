import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyQuoteListItem } from "@/features/agency-portal/types";
import { QuoteRequestActions } from "@/components/agency/QuoteRequestActions";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; quoteCases: AgencyQuoteListItem[]; isPreview?: boolean }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;

export default async function AgencyQuoteCasesPage() {
  const loadState = await loadQuoteCases();

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

      {loadState.status === "ready" ? <QuoteTable quoteCases={loadState.quoteCases} /> : null}

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

function QuoteTable({ quoteCases }: { quoteCases: AgencyQuoteListItem[] }) {
  if (quoteCases.length === 0) {
    return (
      <section className="empty-state">
        <h2>No quotes available</h2>
        <p>Sent quote versions from JHT will appear here.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Agency quotes">
      <table>
        <thead>
          <tr>
            <th>Quote</th>
            <th>Status</th>
            <th>Travel Dates</th>
            <th>Pax</th>
            <th>Version</th>
            <th>Public Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quoteCases.map((quoteCase) => (
            <tr key={quoteCase.id}>
              <td>
                <Link className="strong-link" href={`/agency/quote-cases/${quoteCase.shareId}` as Route}>
                  {quoteCase.tourName}
                </Link>
                <span className="subtext">{quoteCase.caseCode}</span>
              </td>
              <td>
                <span className={`status-dot status-${quoteCase.status}`}>{formatLabel(quoteCase.status)}</span>
              </td>
              <td>{formatDateRange(quoteCase.startDate, quoteCase.endDate)}</td>
              <td>{quoteCase.estimatedPax ?? "Not set"}</td>
              <td>
                {quoteCase.latestVersionNo ? `v${quoteCase.latestVersionNo}` : "Not public"}
                {quoteCase.latestVersionStatus ? (
                  <span className="subtext">{formatLabel(quoteCase.latestVersionStatus)}</span>
                ) : null}
              </td>
              <td>
                {quoteCase.publicTotalAmount === null
                  ? "Not set"
                  : `${quoteCase.currency} ${quoteCase.publicTotalAmount.toLocaleString()}`}
              </td>
              <td>
                <QuoteRequestActions quoteCaseId={quoteCase.id} tourName={quoteCase.tourName} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadQuoteCases(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "ready", quoteCases: demoQuoteCases, isPreview: true };
  }

  const response = await fetch(buildInternalApiUrl("/api/agency/quote-cases", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { status: "ready", quoteCases: demoQuoteCases, isPreview: true };
    }
    return {
      status: "error",
      message: payload.error ?? "Unknown quote API error"
    };
  }

  return { status: "ready", quoteCases: payload.data ?? [] };
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

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

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

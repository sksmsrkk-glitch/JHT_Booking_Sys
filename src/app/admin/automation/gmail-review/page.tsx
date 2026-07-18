/**
 * @file 한글 책임: Next.js App Router의 `/admin/automation/gmail-review` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { GmailReviewActions } from "@/components/admin/GmailReviewActions";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { GmailReviewItem } from "@/features/automation/types";
import type { QuoteCaseListItem } from "@/features/quotation/types";
import type { ReservationListItem } from "@/features/reservation/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ review?: string }>;

type LoadState =
  | { status: "ready"; items: GmailReviewItem[]; quoteCases: QuoteCaseListItem[]; reservations: ReservationListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminGmailReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadItems(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Gmail Review</h1>
          <p>
            Manual review queue for Gmail threads that need case or reservation linking
            confirmation.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/automation/gmail-review">
        <label>
          Review State
          <select name="review" defaultValue={filters.review ?? "manual"}>
            <option value="">All threads</option>
            <option value="manual">Manual review</option>
            <option value="linked">Auto linked</option>
          </select>
        </label>
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Gmail review data could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <GmailReviewTable
          items={loadState.items}
          quoteCases={loadState.quoteCases}
          reservations={loadState.reservations}
        />
      ) : null}

      <section className="notice">
        <h2>Review Guardrails</h2>
        <ul className="clean-list">
          <li>Low-confidence Gmail matches must remain unlinked until reviewed.</li>
          <li>Webhook writes require `GMAIL_WEBHOOK_SECRET`.</li>
          <li>Manual relinking writes audit evidence before production use.</li>
        </ul>
      </section>
    </>
  );
}

function GmailReviewTable({
  items,
  quoteCases,
  reservations
}: {
  items: GmailReviewItem[];
  quoteCases: QuoteCaseListItem[];
  reservations: ReservationListItem[];
}) {
  if (items.length === 0) {
    return (
      <section className="empty-state">
        <h2>No Gmail threads found</h2>
        <p>Webhook-processed Gmail messages will appear here.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Gmail review queue">
      <table>
        <thead>
          <tr>
            <th>Thread</th>
            <th>Agency</th>
            <th>Quote / Reservation</th>
            <th>Confidence</th>
            <th>Review</th>
            <th>Messages</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.latestSubject ?? item.gmailThreadId}</strong>
                <span className="subtext">{item.latestFromEmail ?? "Sender unknown"}</span>
              </td>
              <td>{item.agencyName ?? "Unlinked"}</td>
              <td>
                {item.caseCode ?? item.reservationCode ?? "Unlinked"}
                {item.tourName ? <span className="subtext">{item.tourName}</span> : null}
                {item.matchCandidates.length > 0 ? (
                  <span className="subtext">
                    Candidate: {item.matchCandidates[0].caseCode ?? item.matchCandidates[0].quoteCaseId} (
                    {item.matchCandidates[0].score.toFixed(2)})
                  </span>
                ) : null}
              </td>
              <td>{item.matchConfidence === null ? "Not scored" : item.matchConfidence.toFixed(2)}</td>
              <td>
                <span className={`status-dot ${item.requiresManualReview ? "status-overdue" : "status-live"}`}>
                  {item.requiresManualReview ? "Manual" : "Linked"}
                </span>
              </td>
              <td>{item.messageCount}</td>
              <td>
                <GmailReviewActions
                  defaultQuoteCaseId={item.quoteCaseId}
                  defaultReservationId={item.reservationId}
                  quoteCases={quoteCases}
                  reservations={reservations}
                  threadId={item.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadItems(filters: { review?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads Gmail review data through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [reviewResponse, quoteResponse, reservationResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/automation/gmail-review", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/quote-cases", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/reservations", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [payload, quotePayload, reservationPayload] = await Promise.all([
    reviewResponse.json(),
    quoteResponse.json(),
    reservationResponse.json()
  ]);

  const failedResponse = [reviewResponse, quoteResponse, reservationResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message:
        payload.error ??
        quotePayload.error ??
        reservationPayload.error ??
        "Unknown Gmail review API error"
    };
  }

  return {
    status: "ready",
    items: payload.data ?? [],
    quoteCases: quotePayload.data ?? [],
    reservations: reservationPayload.data ?? []
  };
}

function buildInternalApiUrl(path: string, filters: { review?: string }, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.review) url.searchParams.set("review", filters.review);
  return url;
}

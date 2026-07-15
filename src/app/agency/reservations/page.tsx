import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyReservationListItem } from "@/features/agency-portal/types";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/api/pagination";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; reservations: AgencyReservationListItem[]; pagination: PaginationMeta; isPreview?: boolean }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;
type SearchParams = Promise<{ page?: string; pageSize?: string }>;

export default async function AgencyReservationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const loadState = await loadReservations(params);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Reservations</h1>
          <p>
            View agency-owned reservation status, safe history count, and rooming list revision
            status without internal operation data.
          </p>
        </div>
        <Link className="button-secondary" href={agencyRoute}>
          Back to Portal
        </Link>
      </div>

      <section className="action-band">
        <div>
          <h2>Rooming List Upload</h2>
          <p>
            `POST /api/agency/rooming-lists/upload` accepts reservation-scoped uploads with
            revision/idempotency protection.
          </p>
        </div>
        <span className="status-dot status-live">Upload Ready</span>
      </section>

      {loadState.status === "ready" && loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Agency login is bypassed during development, so this page shows sample reservation rows.</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Reservations could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <>
          <ReservationDatabase pagination={loadState.pagination} reservations={loadState.reservations} />
          <PaginationControls action="/agency/reservations" pagination={loadState.pagination} />
        </>
      ) : null}

      <section className="notice">
        <h2>Reservation boundary</h2>
        <ul className="clean-list">
          <li>Agency users can see only reservations owned by their agency account.</li>
          <li>Passenger PII is not displayed in this summary table.</li>
          <li>Operation tasks and supplier message outbox records are internal-only.</li>
        </ul>
      </section>
    </>
  );
}

function ReservationDatabase({ reservations, pagination }: { reservations: AgencyReservationListItem[]; pagination: PaginationMeta }) {
  if (reservations.length === 0) {
    return (
      <section className="empty-state">
        <h2>No reservations yet</h2>
        <p>Confirmed bookings from accepted quotes will appear here.</p>
      </section>
    );
  }

  const confirmedCount = reservations.filter((reservation) => reservation.status === "confirmed").length;
  const roomingListCount = reservations.reduce((total, reservation) => total + reservation.roomingListCount, 0);

  return (
    <section className="partner-database-shell" aria-label="Agency reservations">
      <div className="partner-database-toolbar">
        <div>
          <p className="eyebrow">Reservation Database</p>
          <h2>Confirmed group records</h2>
        </div>
        <div className="partner-view-tabs" aria-label="Reservation views">
          <span className="active">Table</span>
          <span>Rooming</span>
          <span>Status</span>
        </div>
      </div>

      <div className="partner-database-metrics" aria-label="Reservation metrics">
        <div>
          <span>Reservations</span>
          <strong>{pagination.total}</strong>
        </div>
        <div>
          <span>Confirmed</span>
          <strong>{confirmedCount}</strong>
        </div>
        <div>
          <span>Rooming lists</span>
          <strong>{roomingListCount}</strong>
        </div>
      </div>

      <div className="partner-database-grid partner-reservations-grid">
        <div className="partner-database-header" role="row">
          <span>Reservation</span>
          <span>Status</span>
          <span>Tour Dates</span>
          <span>Quote</span>
          <span>History</span>
          <span>Rooming</span>
        </div>

        {reservations.map((reservation) => (
          <article className="partner-database-row" key={reservation.id}>
            <div className="partner-database-title">
              <small>Reservation</small>
              <strong>
                <Link className="strong-link" href={`/agency/reservations/${reservation.id}` as Route}>
                  {reservation.reservationCode}
                </Link>
              </strong>
              <span>{reservation.tourName ?? "Tour name not set"}</span>
            </div>
            <div className="partner-property">
              <small>Status</small>
              <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
            </div>
            <div className="partner-property">
              <small>Tour Dates</small>
              <strong>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</strong>
            </div>
            <div className="partner-property">
              <small>Quote</small>
              <strong>{reservation.caseCode ?? reservation.quoteCaseId}</strong>
            </div>
            <div className="partner-property">
              <small>Status History</small>
              <strong>{reservation.statusHistoryCount}</strong>
            </div>
            <div className="partner-property">
              <small>Rooming Lists</small>
              <strong>
                <Link className="strong-link" href={`/agency/reservations/${reservation.id}/rooming-lists` as Route}>
                  {reservation.roomingListCount}
                </Link>
              </strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

async function loadReservations(params: { page?: string; pageSize?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "ready",
      reservations: demoReservations,
      pagination: buildPaginationMeta({ page: 1, pageSize: 20 }, demoReservations.length, demoReservations.length),
      isPreview: true
    };
  }

  const url = buildInternalApiUrl("/api/agency/reservations", headerStore);
  if (params.page) url.searchParams.set("page", params.page);
  if (params.pageSize) url.searchParams.set("pageSize", params.pageSize);
  const response = await fetch(url, {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return {
        status: "ready",
        reservations: demoReservations,
        pagination: buildPaginationMeta({ page: 1, pageSize: 20 }, demoReservations.length, demoReservations.length),
        isPreview: true
      };
    }
    return {
      status: "error",
      message: payload.error ?? "Unknown reservation API error"
    };
  }

  return { status: "ready", reservations: payload.data ?? [], pagination: payload.pagination };
}

const demoReservations: AgencyReservationListItem[] = [
  {
    id: "preview-reservation-mhdm",
    reservationCode: "RSV-MY-WORLDTRAV-20260629",
    status: "confirmed",
    tourStartDate: "2026-03-24",
    tourEndDate: "2026-03-28",
    quoteCaseId: "preview-quote-mhdm",
    caseCode: "MY-WORLDTRAV-20260629",
    tourName: "MHDM Seoul 4N group",
    statusHistoryCount: 3,
    roomingListCount: 1,
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

import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyReservationListItem } from "@/features/agency-portal/types";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; reservations: AgencyReservationListItem[]; isPreview?: boolean }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;

export default async function AgencyReservationsPage() {
  const loadState = await loadReservations();

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

      {loadState.status === "ready" ? <ReservationTable reservations={loadState.reservations} /> : null}

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

function ReservationTable({ reservations }: { reservations: AgencyReservationListItem[] }) {
  if (reservations.length === 0) {
    return (
      <section className="empty-state">
        <h2>No reservations yet</h2>
        <p>Confirmed bookings from accepted quotes will appear here.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Agency reservations">
      <table>
        <thead>
          <tr>
            <th>Reservation</th>
            <th>Status</th>
            <th>Tour Dates</th>
            <th>Quote</th>
            <th>Status History</th>
            <th>Rooming Lists</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>
                <Link className="strong-link" href={`/agency/reservations/${reservation.id}` as Route}>
                  {reservation.reservationCode}
                </Link>
                <span className="subtext">{reservation.tourName ?? "Tour name not set"}</span>
              </td>
              <td>
                <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
              </td>
              <td>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</td>
              <td>{reservation.caseCode ?? reservation.quoteCaseId}</td>
              <td>{reservation.statusHistoryCount}</td>
              <td>
                <Link
                  className="strong-link"
                  href={`/agency/reservations/${reservation.id}/rooming-lists` as Route}
                >
                  {reservation.roomingListCount}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadReservations(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "ready", reservations: demoReservations, isPreview: true };
  }

  const response = await fetch(buildInternalApiUrl("/api/agency/reservations", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { status: "ready", reservations: demoReservations, isPreview: true };
    }
    return {
      status: "error",
      message: payload.error ?? "Unknown reservation API error"
    };
  }

  return { status: "ready", reservations: payload.data ?? [] };
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

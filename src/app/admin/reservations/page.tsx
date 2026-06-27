import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { RESERVATION_STATUSES } from "@/features/reservation/queries";
import type { ReservationListItem } from "@/features/reservation/types";
import { ReservationActions } from "@/components/admin/ReservationActions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;

type LoadState =
  | { status: "ready"; reservations: ReservationListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;
const tasksRoute = "/admin/operations/tasks" as Route;

export default async function AdminReservationsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadReservations(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Reservations</h1>
          <p>
            Track accepted quote cases through reservation request, confirmation, operation,
            completion, cancellation, rooming lists, and task generation.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/reservations">
        <label>
          Search
          <input type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Reservation code" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {RESERVATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      <section className="action-band">
        <div>
          <h2>Task Generation</h2>
          <p>
            `POST /api/reservations/:id/generate-operation-tasks` creates default team tasks
            idempotently from the reservation tour start date.
          </p>
        </div>
        <Link className="button-primary" href={tasksRoute}>
          Open Tasks
        </Link>
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
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
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Reservation status changes must write reservation_status_history.</li>
          <li>Agency users can see only their own reservation-safe records.</li>
          <li>Operation tasks and supplier message outbox remain internal-only.</li>
        </ul>
      </section>
    </>
  );
}

function ReservationTable({ reservations }: { reservations: ReservationListItem[] }) {
  if (reservations.length === 0) {
    return (
      <section className="empty-state">
        <h2>No reservations found</h2>
        <p>Accepted quote versions can be converted into reservations from the quote case detail page.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Reservation list">
      <table>
        <thead>
          <tr>
            <th>Reservation</th>
            <th>Agency</th>
            <th>Quote</th>
            <th>Status</th>
            <th>Tour Dates</th>
            <th>Tasks</th>
            <th>Rooming Lists</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>
                <Link className="strong-link" href={`/admin/reservations/${reservation.id}` as Route}>
                  {reservation.reservationCode}
                </Link>
                <span className="subtext">{reservation.tourName ?? "Tour name not set"}</span>
              </td>
              <td>{reservation.agencyName ?? reservation.agencyAccountId}</td>
              <td>{reservation.caseCode ?? reservation.quoteCaseId}</td>
              <td>
                <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
              </td>
              <td>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</td>
              <td>{reservation.taskCount}</td>
              <td>{reservation.roomingListCount}</td>
              <td>
                <ReservationActions
                  hasTourStartDate={Boolean(reservation.tourStartDate)}
                  reservationId={reservation.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadReservations(filters: { q?: string; status?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads reservations through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/reservations", filters, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown reservation API error"
    };
  }

  return { status: "ready", reservations: payload.data ?? [] };
}

function buildInternalApiUrl(path: string, filters: { q?: string; status?: string }, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.status) url.searchParams.set("status", filters.status);
  return url;
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

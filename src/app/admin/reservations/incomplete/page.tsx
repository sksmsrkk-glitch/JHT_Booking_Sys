import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { demoReservations } from "@/features/reservation/demo-data";
import type { ReservationListItem } from "@/features/reservation/types";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; reservations: ReservationListItem[]; isPreview: boolean; previewReason?: string }
  | { status: "error"; message: string };

const reservationsRoute = "/admin/reservations" as Route;

export default async function IncompleteReservationsPage() {
  const loadState = await loadReservations();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Incomplete Reservation Follow-up</h1>
          <p>List view for groups missing hotel, vehicle, guide, driver, or final confirmation actions.</p>
        </div>
        <Link className="button-secondary" href={reservationsRoute}>
          Back to Reservations
        </Link>
      </div>

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Reservations could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <IncompleteList loadState={loadState} /> : null}
    </>
  );
}

function IncompleteList({
  loadState
}: {
  loadState: { reservations: ReservationListItem[]; isPreview: boolean; previewReason?: string };
}) {
  const incomplete = loadState.reservations
    .map((reservation) => ({ reservation, readiness: getReservationReadiness(reservation) }))
    .filter((item) => !item.readiness.complete)
    .sort((left, right) => compareDateValues(left.reservation.tourStartDate, right.reservation.tourStartDate));

  const totalPax = incomplete.reduce((sum, item) => sum + resolvePaxNumber(item.reservation), 0);

  return (
    <>
      {loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>{loadState.previewReason}</p>
        </section>
      ) : null}

      <section className="metric-row">
        <article className="metric-card danger-metric">
          <span>Incomplete groups</span>
          <strong>{incomplete.length}</strong>
        </article>
        <article className="metric-card">
          <span>Total pax</span>
          <strong>{totalPax || "-"}</strong>
        </article>
      </section>

      {incomplete.length === 0 ? (
        <section className="empty-state">
          <h2>No incomplete groups</h2>
          <p>All visible reservations have required operation actions completed.</p>
        </section>
      ) : (
        <section className="table-shell incomplete-followup-table" aria-label="Incomplete reservation follow-up list">
          <table>
            <thead>
              <tr>
                <th>Reservation</th>
                <th>Partner / Group</th>
                <th>Dates</th>
                <th>Pax</th>
                <th>Missing Actions</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {incomplete.map(({ reservation, readiness }) => (
                <tr key={reservation.id}>
                  <td>
                    <Link className="strong-link" href={`/admin/reservations/${reservation.id}` as Route}>
                      {reservation.reservationCode}
                    </Link>
                    <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
                  </td>
                  <td>
                    <strong>{reservation.tourName ?? "Tour name not set"}</strong>
                    <span className="subtext">{reservation.agencyName ?? reservation.agencyAccountId}</span>
                  </td>
                  <td>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</td>
                  <td>{formatPax(reservation)}</td>
                  <td>
                    <div className="missing-action-list">
                      {readiness.missing.map((missing) => (
                        <span key={missing}>{missing}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Link
                      className="button-secondary mini-button"
                      href={`/admin/reservations/${reservation.id}/operation-checklist` as Route}
                    >
                      Checklist
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

const REQUIRED_OPERATION_ACTIONS = [
  {
    label: "Hotel block",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "hotel_booking" && /hotel[_-]?block|hotel[_-]?booking|room[_-]?block/i.test(task.taskType)
  },
  {
    label: "Hotel reconfirm / final confirmation",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "hotel_booking" && /reconfirm|final|confirm/i.test(task.taskType)
  },
  {
    label: "Vehicle booking",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "vehicle_booking" && /vehicle|coach|bus|transport/i.test(task.taskType)
  },
  {
    label: "Guide assignment",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "guide_assignment" && /guide/i.test(task.taskType)
  },
  {
    label: "Driver information",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "vehicle_booking" && /driver/i.test(task.taskType)
  }
];

function getReservationReadiness(reservation: ReservationListItem) {
  const doneTasks = reservation.operationTaskSummary.filter((task) => ["done", "completed"].includes(task.status));
  const missing = REQUIRED_OPERATION_ACTIONS.filter(
    (action) => !doneTasks.some((task) => action.matches(task))
  ).map((action) => action.label);
  return {
    complete: missing.length === 0,
    missing
  };
}

async function loadReservations(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "ready",
      reservations: demoReservations,
      isPreview: true,
      previewReason:
        "Internal API access requires a Supabase internal-role JWT. Showing dummy group-status data for UI review."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/reservations", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return {
        status: "ready",
        reservations: demoReservations,
        isPreview: true,
        previewReason: "The live reservation API rejected the current session. Showing dummy group-status data."
      };
    }
    return { status: "error", message: payload.error ?? "Unknown reservation API error" };
  }

  const reservations = payload.data ?? [];
  return {
    status: "ready",
    reservations: reservations.length > 0 ? reservations : demoReservations,
    isPreview: reservations.length === 0,
    previewReason:
      reservations.length === 0
        ? "The live database returned no reservation rows yet. Showing dummy group-status data."
        : undefined
  };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function compareDateValues(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
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

function formatPax(reservation: ReservationListItem) {
  const pax = resolvePaxNumber(reservation);
  return pax > 0 ? `${pax} pax` : "Not set";
}

function resolvePaxNumber(reservation: ReservationListItem) {
  if (reservation.estimatedPax) return reservation.estimatedPax;
  return 0;
}

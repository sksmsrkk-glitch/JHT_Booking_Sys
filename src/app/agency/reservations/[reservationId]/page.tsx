import type { Route } from "next";
import Link from "next/link";
import { RoomingListUploadForm } from "@/components/agency/RoomingListUploadForm";
import type { AgencyReservationDetail } from "@/features/agency-portal/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ reservationId: string }>;

type LoadState =
  | { status: "ready"; reservation: AgencyReservationDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const reservationsRoute = "/agency/reservations" as Route;

export default async function AgencyReservationDetailPage({ params }: { params: PageParams }) {
  const { reservationId } = await params;
  const loadState = await loadReservation(reservationId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Overseas Agency Portal</p>
            <h1>Reservation Detail</h1>
            <p>Reservation status, rooming list revisions, and upload workflow.</p>
          </div>
          <Link className="button-secondary" href={reservationsRoute}>
            Back to Reservations
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Reservation not found" : "Reservation could not load"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const reservation = loadState.reservation;
  const nextRevisionNo =
    reservation.roomingLists.reduce((max, roomingList) => Math.max(max, roomingList.revisionNo), 0) + 1;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>{reservation.reservationCode}</h1>
          <p>{reservation.tourName ?? "Tour name not set"}</p>
        </div>
        <div className="inline-actions">
          <Link className="button-primary" href={`/agency/reservations/${reservation.id}/rooming-lists` as Route}>
            Rooming Lists
          </Link>
          <Link className="button-secondary" href={reservationsRoute}>
            Back to Reservations
          </Link>
        </div>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Reservation</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
              </dd>
            </div>
            <div>
              <dt>Tour Dates</dt>
              <dd>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</dd>
            </div>
            <div>
              <dt>Quote</dt>
              <dd>{reservation.caseCode ?? reservation.quoteCaseId}</dd>
            </div>
            <div>
              <dt>Rooming Lists</dt>
              <dd>{reservation.roomingLists.length}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Upload Rooming List</h2>
          <RoomingListUploadForm nextRevisionNo={nextRevisionNo} reservationId={reservation.id} />
        </article>
      </section>

      <section className="detail-grid section-block">
        <article className="panel">
          <h2>Status History</h2>
          {reservation.statusHistory.length > 0 ? (
            <ul className="clean-list">
              {reservation.statusHistory.map((history) => (
                <li key={history.id}>
                  {formatLabel(history.fromStatus ?? "none")} to {formatLabel(history.toStatus)}
                  <span className="subtext">
                    {formatDateTime(history.createdAt)}
                    {history.reason ? ` - ${history.reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No status history available yet.</p>
          )}
        </article>
        <article className="panel">
          <h2>Rooming List Revisions</h2>
          {reservation.roomingLists.length > 0 ? (
            <ul className="clean-list">
              {reservation.roomingLists.map((roomingList) => (
                <li key={roomingList.id}>
                  rev {roomingList.revisionNo}: {roomingList.originalFilename ?? "Uploaded file"}
                  <span className="subtext">
                    {formatLabel(roomingList.parsedStatus)} - {formatDateTime(roomingList.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No rooming list uploaded.</p>
          )}
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Passengers</h2>
          <span>{reservation.passengers.length} passengers</span>
        </div>
        {reservation.passengers.length > 0 ? (
          <section className="table-shell" aria-label="Agency reservation passengers">
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>DOB</th>
                  <th>Dietary</th>
                  <th>Coach</th>
                </tr>
              </thead>
              <tbody>
                {reservation.passengers.map((passenger) => (
                  <tr key={passenger.id}>
                    <td>{passenger.passengerNo ?? "n/a"}</td>
                    <td>{passenger.fullName}</td>
                    <td>{passenger.gender ?? "Not set"}</td>
                    <td>{passenger.dateOfBirth ?? "Not set"}</td>
                    <td>{passenger.dietaryRequirements ?? "None"}</td>
                    <td>{passenger.coachLabel ?? "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No passengers</h2>
            <p>Passenger rows appear after a rooming list upload with passenger JSON.</p>
          </section>
        )}
      </section>

      <section className="notice">
        <h2>Agency-safe boundary</h2>
        <ul className="clean-list">
          <li>This page does not read operation tasks or supplier message outbox records.</li>
          <li>Rooming list uploads are scoped to agency-owned reservations through Supabase RLS.</li>
          <li>Passenger rows are accepted by the upload API but not displayed in this summary.</li>
        </ul>
      </section>
    </>
  );
}

async function loadReservation(reservationId: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message: "This page requires an active agency user JWT."
    };
  }

  const response = await fetch(buildInternalApiUrl(`/api/agency/reservations/${reservationId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 404) return { status: "not-found", message: payload.error ?? "Reservation not found" };
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown reservation detail API error"
    };
  }

  return { status: "ready", reservation: payload.data };
}

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

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

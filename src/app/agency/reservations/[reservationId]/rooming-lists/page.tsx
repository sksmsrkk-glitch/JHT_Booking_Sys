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

export default async function AgencyReservationRoomingListsPage({ params }: { params: PageParams }) {
  const { reservationId } = await params;
  const loadState = await loadReservation(reservationId);
  const reservationRoute = `/agency/reservations/${reservationId}` as Route;

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Overseas Agency Portal</p>
            <h1>Rooming Lists</h1>
            <p>Upload rooming list revisions for an agency-owned reservation.</p>
          </div>
          <Link className="button-secondary" href={reservationRoute}>
            Back to Reservation
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
          <h1>Rooming Lists</h1>
          <p>
            {reservation.reservationCode} - {reservation.tourName ?? "Tour name not set"}
          </p>
        </div>
        <Link className="button-secondary" href={reservationRoute}>
          Back to Reservation
        </Link>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Upload Revision</h2>
          <RoomingListUploadForm nextRevisionNo={nextRevisionNo} reservationId={reservation.id} />
        </article>
        <article className="panel">
          <h2>Revision Summary</h2>
          <dl className="definition-list">
            <div>
              <dt>Current Revisions</dt>
              <dd>{reservation.roomingLists.length}</dd>
            </div>
            <div>
              <dt>Next Revision No.</dt>
              <dd>{nextRevisionNo}</dd>
            </div>
            <div>
              <dt>Passenger Rows</dt>
              <dd>{reservation.passengers.length}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Uploaded Revisions</h2>
          <span>{reservation.roomingLists.length} files</span>
        </div>
        {reservation.roomingLists.length > 0 ? (
          <section className="table-shell" aria-label="Agency rooming list revisions">
            <table>
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Filename</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {reservation.roomingLists.map((roomingList) => (
                  <tr key={roomingList.id}>
                    <td>rev {roomingList.revisionNo}</td>
                    <td>{roomingList.originalFilename ?? "Uploaded file"}</td>
                    <td>
                      <span className={`status-dot status-${roomingList.parsedStatus}`}>
                        {formatLabel(roomingList.parsedStatus)}
                      </span>
                    </td>
                    <td>{formatDateTime(roomingList.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No rooming list uploaded</h2>
            <p>Upload the first revision when passenger names and rooming data are ready.</p>
          </section>
        )}
      </section>

      <section className="notice">
        <h2>Agency-safe boundary</h2>
        <ul className="clean-list">
          <li>Uploads are scoped to this reservation and protected by revision/idempotency keys.</li>
          <li>Passport values may be submitted for operations but are not shown back in this portal view.</li>
          <li>Internal operation tasks and supplier communication records remain hidden.</li>
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

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

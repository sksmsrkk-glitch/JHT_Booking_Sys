import type { Route } from "next";
import Link from "next/link";
import { ConfirmationDocument } from "@/components/admin/ConfirmationDocument";
import { FinalOperationSnapshotForm } from "@/components/admin/FinalOperationSnapshotForm";
import { getDemoReservationDetail } from "@/features/reservation/demo-data";
import type { ReservationDetail } from "@/features/reservation/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ reservationId: string }>;

type LoadState =
  | { status: "ready"; reservation: ReservationDetail; isPreview: boolean }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const confirmationsRoute = "/admin/confirmations" as Route;

export default async function ConfirmationDetailPage({ params }: { params: PageParams }) {
  const { reservationId } = await params;
  const loadState = await loadReservation(reservationId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Final Confirmation</p>
            <h1>Confirmation Document</h1>
            <p>Create the confirmation document after a quote is accepted.</p>
          </div>
          <Link className="button-secondary" href={confirmationsRoute}>
            Back to Confirmations
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Reservation not found" : "Confirmation could not load"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const { reservation, isPreview } = loadState;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Final Confirmation</p>
          <h1>{reservation.tourName ?? reservation.reservationCode}</h1>
          <p>{reservation.reservationCode} / {formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</p>
        </div>
        <div className="inline-actions">
          <Link className="button-secondary" href={confirmationsRoute}>
            Back
          </Link>
          <Link className="button-secondary" href={`/admin/reservations/${reservation.id}` as Route}>
            Reservation
          </Link>
        </div>
      </div>

      {isPreview ? (
        <section className="notice warning">
          <h2>Preview mode</h2>
          <p>Saving and invoice issue are simulated until an internal user is signed in.</p>
        </section>
      ) : null}

      <section className="workflow-chain">
        <article>
          <span>1</span>
          <h2>Accepted Quote</h2>
          <p>{reservation.acceptedQuoteVersion ? `Quote v${reservation.acceptedQuoteVersion.versionNo}` : "Not linked"}</p>
        </article>
        <article>
          <span>2</span>
          <h2>Final Confirmation</h2>
          <p>Operator final hotel, room, meals, itinerary, and flight details.</p>
        </article>
        <article>
          <span>3</span>
          <h2>Invoice</h2>
          <p>Finalized confirmation can issue a versioned invoice automatically.</p>
        </article>
      </section>

      <section className="panel-section print-surface">
        <div className="section-heading no-print">
          <div>
            <h2>Confirmation Document Preview</h2>
            <p>Use this as the partner-ready confirmation document base.</p>
          </div>
          <span>{reservation.acceptedQuoteVersion?.currency ?? "KRW"}</span>
        </div>
        <ConfirmationDocument reservation={reservation} />
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Final Confirmation Builder</h2>
            <p>Enter the final operator-confirmed values. These values override quote itinerary fields when invoice is issued.</p>
          </div>
          <span>{reservation.acceptedQuoteVersion ? "Ready" : "Accepted quote required"}</span>
        </div>
        <FinalOperationSnapshotForm
          disabledReason={!reservation.acceptedQuoteVersionId ? "Accepted quote version is required." : undefined}
          previewMode={isPreview}
          reservationId={reservation.id}
        />
      </section>
    </>
  );
}

async function loadReservation(reservationId: string): Promise<LoadState> {
  const demoReservation = getDemoReservationDetail(reservationId);
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    if (demoReservation) return { status: "ready", reservation: demoReservation, isPreview: true };
    return { status: "not-found", message: "Preview reservation not found." };
  }

  const response = await fetch(buildInternalApiUrl(`/api/reservations/${reservationId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403 || response.status === 404) && demoReservation) {
      return { status: "ready", reservation: demoReservation, isPreview: true };
    }
    if (response.status === 404) return { status: "not-found", message: payload.error ?? "Reservation not found" };
    return { status: "error", message: payload.error ?? "Unknown reservation API error" };
  }

  return { status: "ready", reservation: payload.data, isPreview: false };
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

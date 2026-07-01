import type { Route } from "next";
import Link from "next/link";
import { demoReservations } from "@/features/reservation/demo-data";
import type { ReservationListItem } from "@/features/reservation/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; reservations: ReservationListItem[]; previewMode: boolean }
  | { status: "error"; message: string; reservations: ReservationListItem[]; previewMode: boolean };

export default async function GuideExpenseReportsPage() {
  const loadState = await loadReservations();
  const reservations = loadState.reservations;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Guide Expense Reports</h1>
          <p>투어 종료 후 가이드가 작성하는 실비 지출결의서를 예약, 인보이스, 정산과 함께 관리합니다.</p>
        </div>
        <Link className="button-secondary" href={"/admin/finance/invoices" as Route}>
          Finance
        </Link>
      </div>

      {loadState.previewMode ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>로그인/Supabase 권한 없이도 PMB 지출결의서 흐름을 확인할 수 있도록 더미 예약을 표시합니다.</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Could not load live reservations</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Confirmed Groups</span>
          <strong>{reservations.filter((reservation) => reservation.status === "confirmed").length}</strong>
        </article>
        <article className="metric-card">
          <span>Total Pax</span>
          <strong>{reservations.reduce((sum, reservation) => sum + Number(reservation.estimatedPax ?? 0), 0).toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>Expense Source</span>
          <strong>PMB Excel</strong>
        </article>
      </section>

      <section className="table-shell" aria-label="Guide expense report reservation list">
        <table>
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Agency / Group</th>
              <th>Pax</th>
              <th>Dates</th>
              <th>Workflow</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr key={reservation.id}>
                <td>
                  <strong>{reservation.reservationCode}</strong>
                  <span className="subtext">{reservation.caseCode}</span>
                </td>
                <td>
                  <strong>{reservation.tourName}</strong>
                  <span className="subtext">{reservation.agencyName}</span>
                </td>
                <td>{reservation.estimatedPax ?? "-"} pax</td>
                <td>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</td>
                <td>
                  <span className="status-dot status-live">Invoice + Actual Cost</span>
                </td>
                <td>
                  <Link className="button-secondary" href={`/admin/guide-expenses/${reservation.id}` as Route}>
                    Open Report
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

async function loadReservations(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "ready", reservations: demoReservations, previewMode: true };
  }

  const response = await fetch(buildInternalApiUrl("/api/reservations", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: "error",
      message: payload.error ?? "Unknown reservations API error",
      reservations: demoReservations,
      previewMode: true
    };
  }

  return { status: "ready", reservations: payload.data ?? [], previewMode: false };
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

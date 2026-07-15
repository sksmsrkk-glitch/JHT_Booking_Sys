import type { Route } from "next";
import Link from "next/link";
import { GuideExpenseReportForm } from "@/components/admin/GuideExpenseReportForm";
import { getDemoReservationDetail } from "@/features/reservation/demo-data";
import type { ReservationDetail } from "@/features/reservation/types";
import { getPageAuthorization } from "@/lib/api/page-session";
import { isDemoModeEnabled } from "@/lib/api/guards";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ reservationId: string }>;

type LoadState =
  | { status: "ready"; reservation: ReservationDetail; report: any | null; previewMode: boolean }
  | { status: "error"; message: string };

export default async function GuideExpenseReportDetailPage({ params }: { params: PageParams }) {
  const { reservationId } = await params;
  const loadState = await loadPageData(reservationId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Internal Admin</p>
            <h1>Guide Expense Report</h1>
            <p>Actual tour cost report could not load.</p>
          </div>
          <Link className="button-secondary" href={"/admin/guide-expenses" as Route}>
            Back
          </Link>
        </div>
        <section className="notice warning">
          <h2>Report could not load</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const { reservation, report, previewMode } = loadState;
  const acceptedQuoteTotal = reservation.acceptedQuoteVersion?.publicTotalAmount ?? 0;
  const workflowCode = buildWorkflowCode(reservation);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Guide Settlement</p>
          <h1>{reservation.tourName ?? reservation.reservationCode}</h1>
          <p>{reservation.agencyName} / {formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</p>
        </div>
        <div className="inline-actions">
          <Link className="button-secondary" href={`/admin/workflows/${workflowCode}` as Route}>
            Open Workflow
          </Link>
          <Link className="button-secondary" href={"/admin/guide-expenses" as Route}>
            Back to Reports
          </Link>
        </div>
      </div>

      {previewMode ? (
        <section className="notice warning">
          <h2>Preview mode</h2>
          <p>PMB 인센티브 파일의 실제 양식과 예시 데이터를 기반으로 화면을 확인합니다. 로그인 후에는 저장 시 DB와 정산 지출이 함께 업데이트됩니다.</p>
        </section>
      ) : null}

      <section className="detail-grid">
        <article className="panel">
          <h2>Reservation Link</h2>
          <dl className="definition-list">
            <div>
              <dt>Reservation</dt>
              <dd>{reservation.reservationCode}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><span className={`status-dot status-${reservation.status}`}>{reservation.status}</span></dd>
            </div>
            <div>
              <dt>Pax</dt>
              <dd>{reservation.estimatedPax ?? "-"} pax</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Invoice / Sales Base</h2>
          <dl className="definition-list">
            <div>
              <dt>Accepted Quote</dt>
              <dd>KRW {acceptedQuoteTotal.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Expense Report</dt>
              <dd>{report?.status ?? "Draft not created"}</dd>
            </div>
            <div>
              <dt>Finance Flow</dt>
              <dd>Submitted report lines sync to expenses and settlement recalculation.</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Communication Ledger</h2>
          <dl className="definition-list">
            <div>
              <dt>Workflow Code</dt>
              <dd>{workflowCode}</dd>
            </div>
            <div>
              <dt>Portal Thread</dt>
              <dd>Partner requests, JHT replies, internal notes, and action items are managed in one workflow.</dd>
            </div>
          </dl>
          <Link className="button-secondary" href={`/admin/workflows/${workflowCode}` as Route}>
            Open Communication
          </Link>
        </article>
      </section>

      <GuideExpenseReportForm
        initialReport={buildInitialReport(reservation, report)}
        previewMode={previewMode}
        reservationId={reservation.id}
      />
    </>
  );
}

async function loadPageData(reservationId: string): Promise<LoadState> {
  const demoReservation = getDemoReservationDetail(reservationId);
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    if (isDemoModeEnabled() && demoReservation) {
      return { status: "ready", reservation: demoReservation, report: null, previewMode: true };
    }
    return { status: "error", message: "Internal login is required for live guide expense reports." };
  }

  const [reservationResponse, reportResponse] = await Promise.all([
    fetch(buildInternalApiUrl(`/api/reservations/${reservationId}`, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl(`/api/reservations/${reservationId}/guide-expense-report`, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);

  const reservationPayload = await reservationResponse.json();
  const reportPayload = await reportResponse.json();
  if (!reservationResponse.ok) {
    if (isDemoModeEnabled() && demoReservation) {
      return { status: "ready", reservation: demoReservation, report: null, previewMode: true };
    }
    return { status: "error", message: reservationPayload.error ?? "Reservation could not load" };
  }
  if (!reportResponse.ok) {
    return { status: "error", message: reportPayload.error ?? "Guide expense report could not load" };
  }

  return {
    status: "ready",
    reservation: reservationPayload.data,
    report: reportPayload.data,
    previewMode: false
  };
}

function buildInitialReport(reservation: ReservationDetail, report: any | null) {
  const workflowCode = buildWorkflowCode(reservation);
  if (!report) {
    return {
      reportNo: workflowCode,
      guideName: "",
      groupTitle: reservation.tourName,
      paxCount: reservation.estimatedPax,
      tourStartDate: reservation.tourStartDate,
      tourEndDate: reservation.tourEndDate,
      currency: "KRW",
      cashAdvanceAmount: 0,
      lines: []
    };
  }

  return {
    reportNo: workflowCode,
    status: report.status,
    guideName: report.guide_name,
    guidePhone: report.guide_phone,
    tourLeaderName: report.tour_leader_name,
    groupTitle: report.group_title,
    paxCount: report.pax_count,
    tourStartDate: report.tour_start_date,
    tourEndDate: report.tour_end_date,
    currency: report.currency,
    cashAdvanceAmount: report.cash_advance_amount,
    internalNotes: report.internal_notes,
    lines: (report.guide_expense_report_lines ?? []).map((line: any) => ({
      id: line.id,
      lineNo: line.line_no,
      section: line.section,
      expenseDate: line.expense_date ?? "",
      dayNo: line.day_no ? String(line.day_no) : "",
      vendorName: line.vendor_name ?? "",
      description: line.description ?? "",
      unitAmount: String(line.unit_amount ?? 0),
      quantity: String(line.quantity ?? 1),
      paxCount: line.pax_count ? String(line.pax_count) : "",
      totalAmount: String(line.total_amount ?? 0),
      paymentMethod: line.payment_method ?? "cash",
      notes: line.notes ?? ""
    }))
  };
}

function buildWorkflowCode(reservation: ReservationDetail) {
  return reservation.caseCode ?? reservation.reservationCode ?? reservation.id;
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

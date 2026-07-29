/**
 * @file 한글 책임: 투어 코드 하나의 전체 진행 상황(단체 상황판)을 한 번에 조회해 화면 모델로 만듭니다.
 * 견적·예약·운영·확정서·인보이스·정산이 여러 페이지에 흩어져 있어 담당자가 페이지를 순회해야 했던 문제를 해소합니다.
 * 내부 원가·마진은 내부 전용 테이블에서만 읽으며, 이 모듈은 어드민 화면에서만 사용합니다.
 */
import type { WorkflowThreadDetail } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type CockpitStageKey =
  | "inquiry"
  | "quote"
  | "accepted"
  | "reservation"
  | "operations"
  | "confirmation"
  | "invoice"
  | "settlement";

export type CockpitStage = {
  key: CockpitStageKey;
  labelKo: string;
  labelEn: string;
  /** done: 끝남 · current: 지금 단계 · pending: 아직 */
  state: "done" | "current" | "pending";
  detail: string | null;
};

export type CockpitAction = {
  /** danger: 지연·기한초과 · warning: 대기중 · info: 다음 단계 */
  tone: "danger" | "warning" | "info";
  labelKo: string;
  labelEn: string;
  href: string;
};

export type GroupCockpit = {
  workflowCode: string;
  title: string;
  agencyName: string | null;
  tourStartDate: string | null;
  tourEndDate: string | null;
  paxCount: number | null;
  stages: CockpitStage[];
  actions: CockpitAction[];
  money: {
    currency: string | null;
    publicTotal: number | null;
    internalCost: number | null;
    internalMargin: number | null;
    invoiceTotal: number | null;
    confirmedPaid: number | null;
  };
  taskSummary: { total: number; done: number; overdue: number };
  pendingBookingRequest: boolean;
};

/**
 * 워크플로우 스레드가 들고 있는 문서 ID들을 따라가 각 단계의 실제 상태를 읽습니다.
 * 새 테이블 없이 기존 연결(workflow_threads)만 사용합니다.
 */
export async function getGroupCockpit(
  supabase: SupabaseClientLike,
  workflow: WorkflowThreadDetail
): Promise<GroupCockpit> {
  const quoteCaseId = workflow.linkedDocs.quoteCaseId;
  const reservationId = workflow.linkedDocs.reservationId;

  const [quoteCase, reservation, tasks, snapshot, invoices, settlement, pendingRequests] = await Promise.all([
    quoteCaseId ? fetchQuoteCase(supabase, quoteCaseId) : null,
    reservationId ? fetchReservation(supabase, reservationId) : null,
    reservationId ? fetchTasks(supabase, reservationId) : { total: 0, done: 0, overdue: 0 },
    reservationId ? fetchSnapshot(supabase, reservationId) : null,
    reservationId ? fetchInvoices(supabase, reservationId) : [],
    reservationId ? fetchSettlement(supabase, reservationId) : null,
    quoteCaseId ? fetchPendingBookingRequests(supabase, quoteCaseId) : 0
  ]);

  const latestVersion = quoteCase?.latestVersion ?? null;
  const latestInvoice = invoices[0] ?? null;
  const hasSentVersion = Boolean(quoteCase?.hasSentVersion);
  const isAccepted = quoteCase?.status === "accepted" || latestVersion?.status === "accepted";
  const operationsDone = tasks.total > 0 && tasks.done === tasks.total;
  const snapshotFinalized = snapshot?.status === "finalized";
  const invoiceIssued = Boolean(latestInvoice);
  const settlementDone = settlement ? ["approved", "closed"].includes(settlement.status) : false;

  const stages = buildStages({
    hasInquiry: Boolean(workflow.linkedDocs.inquiryId),
    hasQuote: Boolean(quoteCaseId),
    hasSentVersion,
    isAccepted,
    hasReservation: Boolean(reservationId),
    tasks,
    operationsDone,
    snapshotFinalized,
    invoiceIssued,
    settlementDone,
    quoteStatus: quoteCase?.status ?? null,
    reservationStatus: reservation?.status ?? null,
    invoiceStatus: latestInvoice?.status ?? null,
    settlementStatus: settlement?.status ?? null
  });

  const actions = buildActions({
    workflowCode: workflow.workflowCode,
    quoteCaseId,
    reservationId,
    invoiceId: latestInvoice?.id ?? null,
    hasSentVersion,
    isAccepted,
    pendingBookingRequest: pendingRequests > 0,
    tasks,
    snapshotFinalized,
    invoiceIssued,
    invoiceUnpaid: latestInvoice ? Number(latestInvoice.total ?? 0) > Number(latestInvoice.paid ?? 0) : false,
    settlementStatus: settlement?.status ?? null
  });

  return {
    workflowCode: workflow.workflowCode,
    title: quoteCase?.tourName ?? workflow.title,
    agencyName: workflow.agencyName ?? null,
    tourStartDate: reservation?.startDate ?? quoteCase?.startDate ?? null,
    tourEndDate: reservation?.endDate ?? quoteCase?.endDate ?? null,
    paxCount: quoteCase?.estimatedPax ?? null,
    stages,
    actions,
    money: {
      currency: quoteCase?.currency ?? latestInvoice?.currency ?? null,
      publicTotal: latestVersion?.publicTotal ?? null,
      internalCost: quoteCase?.internalCost ?? null,
      internalMargin: quoteCase?.internalMargin ?? null,
      invoiceTotal: latestInvoice ? Number(latestInvoice.total ?? 0) : null,
      confirmedPaid: latestInvoice ? Number(latestInvoice.paid ?? 0) : null
    },
    taskSummary: tasks,
    pendingBookingRequest: pendingRequests > 0
  };
}

function buildStages(input: {
  hasInquiry: boolean;
  hasQuote: boolean;
  hasSentVersion: boolean;
  isAccepted: boolean;
  hasReservation: boolean;
  tasks: { total: number; done: number; overdue: number };
  operationsDone: boolean;
  snapshotFinalized: boolean;
  invoiceIssued: boolean;
  settlementDone: boolean;
  quoteStatus: string | null;
  reservationStatus: string | null;
  invoiceStatus: string | null;
  settlementStatus: string | null;
}): CockpitStage[] {
  const done = [
    input.hasInquiry,
    input.hasQuote,
    input.isAccepted,
    input.hasReservation,
    input.operationsDone,
    input.snapshotFinalized,
    input.invoiceIssued,
    input.settlementDone
  ];

  const labels: Array<{ key: CockpitStageKey; ko: string; en: string; detail: string | null }> = [
    { key: "inquiry", ko: "문의", en: "Inquiry", detail: null },
    { key: "quote", ko: "견적", en: "Quote", detail: input.quoteStatus },
    { key: "accepted", ko: "수락", en: "Accepted", detail: null },
    { key: "reservation", ko: "예약", en: "Reservation", detail: input.reservationStatus },
    {
      key: "operations",
      ko: "운영",
      en: "Operations",
      detail: input.tasks.total > 0 ? `${input.tasks.done}/${input.tasks.total}` : null
    },
    { key: "confirmation", ko: "확정서", en: "Confirmation", detail: null },
    { key: "invoice", ko: "인보이스", en: "Invoice", detail: input.invoiceStatus },
    { key: "settlement", ko: "정산", en: "Settlement", detail: input.settlementStatus }
  ];

  // 첫 번째 미완료 단계가 "현재 단계"입니다.
  const currentIndex = done.findIndex((value) => !value);

  return labels.map((label, index) => ({
    key: label.key,
    labelKo: label.ko,
    labelEn: label.en,
    state: done[index] ? "done" : index === currentIndex ? "current" : "pending",
    detail: label.detail
  }));
}

function buildActions(input: {
  workflowCode: string;
  quoteCaseId: string | null;
  reservationId: string | null;
  invoiceId: string | null;
  hasSentVersion: boolean;
  isAccepted: boolean;
  pendingBookingRequest: boolean;
  tasks: { total: number; done: number; overdue: number };
  snapshotFinalized: boolean;
  invoiceIssued: boolean;
  invoiceUnpaid: boolean;
  settlementStatus: string | null;
}): CockpitAction[] {
  const actions: CockpitAction[] = [];

  if (input.tasks.overdue > 0 && input.reservationId) {
    actions.push({
      tone: "danger",
      labelKo: `지연된 운영 업무 ${input.tasks.overdue}건 처리`,
      labelEn: `Resolve ${input.tasks.overdue} overdue task(s)`,
      href: "/admin/operations/tasks"
    });
  }

  if (input.pendingBookingRequest && input.quoteCaseId) {
    actions.push({
      tone: "warning",
      labelKo: "파트너 예약 요청을 예약으로 전환",
      labelEn: "Convert partner booking request",
      href: `/admin/quote-cases/${input.quoteCaseId}`
    });
  }

  /*
   * 운영 업무가 남아 있으면(아직 기한은 지나지 않았더라도) 현재 단계에 대한 안내를 함께 보여줍니다.
   * 이것이 없으면 진행 바에는 "운영"이 현재 단계로 표시되는데 액션 목록에는 아무 언급이 없어 어긋나 보입니다.
   */
  if (input.tasks.total > 0 && input.tasks.done < input.tasks.total && input.tasks.overdue === 0) {
    actions.push({
      tone: "info",
      labelKo: `운영 업무 진행 중 (${input.tasks.done}/${input.tasks.total})`,
      labelEn: `Operation tasks in progress (${input.tasks.done}/${input.tasks.total})`,
      href: "/admin/operations/tasks"
    });
  }

  if (!input.hasSentVersion && input.quoteCaseId) {
    actions.push({
      tone: "info",
      labelKo: "견적 버전 발송",
      labelEn: "Send a quote version",
      href: `/admin/quote-cases/${input.quoteCaseId}`
    });
  } else if (input.isAccepted && !input.reservationId && input.quoteCaseId) {
    actions.push({
      tone: "info",
      labelKo: "수락된 견적을 예약으로 전환",
      labelEn: "Create reservation from accepted quote",
      href: `/admin/quote-cases/${input.quoteCaseId}`
    });
  } else if (input.reservationId && !input.snapshotFinalized) {
    actions.push({
      tone: "info",
      labelKo: "확정서 작성",
      labelEn: "Complete the confirmation",
      href: `/admin/confirmations/${input.reservationId}`
    });
  } else if (input.snapshotFinalized && !input.invoiceIssued && input.reservationId) {
    actions.push({
      tone: "info",
      labelKo: "인보이스 발행",
      labelEn: "Issue the invoice",
      href: `/admin/confirmations/${input.reservationId}`
    });
  } else if (input.invoiceIssued && input.invoiceUnpaid && input.invoiceId) {
    actions.push({
      tone: "warning",
      labelKo: "입금 확인",
      labelEn: "Record the payment",
      href: `/admin/finance/invoices/${input.invoiceId}`
    });
  } else if (input.settlementStatus && !["approved", "closed"].includes(input.settlementStatus)) {
    actions.push({
      tone: "info",
      labelKo: "정산 승인",
      labelEn: "Approve the settlement",
      href: "/admin/finance/settlements"
    });
  }

  return actions;
}

async function fetchQuoteCase(supabase: SupabaseClientLike, quoteCaseId: string) {
  const { data, error } = await supabase
    .from("quote_cases")
    .select(
      "id, tour_name, status, currency, estimated_pax, start_date, end_date, quote_versions(id, version_no, status, public_total_amount, quote_version_internals(internal_total_cost_krw, internal_total_margin_krw))"
    )
    .eq("id", quoteCaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const versions = Array.isArray(data.quote_versions) ? data.quote_versions : [];
  const sorted = [...versions].sort((left, right) => Number(right.version_no) - Number(left.version_no));
  const latest = sorted[0] ?? null;
  const internals = latest ? resolveOne(latest.quote_version_internals) : null;

  return {
    tourName: data.tour_name as string,
    status: data.status as string,
    currency: (data.currency ?? null) as string | null,
    estimatedPax: data.estimated_pax === null || data.estimated_pax === undefined ? null : Number(data.estimated_pax),
    startDate: (data.start_date ?? null) as string | null,
    endDate: (data.end_date ?? null) as string | null,
    hasSentVersion: versions.some((version: any) => ["sent", "accepted", "superseded"].includes(version.status)),
    latestVersion: latest
      ? { status: latest.status as string, publicTotal: Number(latest.public_total_amount ?? 0) }
      : null,
    internalCost: internals ? Number(internals.internal_total_cost_krw ?? 0) : null,
    internalMargin: internals ? Number(internals.internal_total_margin_krw ?? 0) : null
  };
}

async function fetchReservation(supabase: SupabaseClientLike, reservationId: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, status, tour_start_date, tour_end_date")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    status: data.status as string,
    startDate: (data.tour_start_date ?? null) as string | null,
    endDate: (data.tour_end_date ?? null) as string | null
  };
}

async function fetchTasks(supabase: SupabaseClientLike, reservationId: string) {
  const { data, error } = await supabase
    .from("operation_tasks")
    .select("id, status, due_at")
    .eq("reservation_id", reservationId);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const now = Date.now();
  return {
    total: rows.length,
    done: rows.filter((row: any) => ["done", "cancelled"].includes(row.status)).length,
    overdue: rows.filter(
      (row: any) => row.due_at && !["done", "cancelled"].includes(row.status) && new Date(row.due_at).getTime() < now
    ).length
  };
}

async function fetchSnapshot(supabase: SupabaseClientLike, reservationId: string) {
  const { data, error } = await supabase
    .from("reservation_final_operation_snapshots")
    .select("id, status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? { status: data.status as string } : null;
}

async function fetchInvoices(supabase: SupabaseClientLike, reservationId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, status, currency, total_amount, version_no, payments(status, amount)")
    .eq("reservation_id", reservationId)
    .order("version_no", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    status: row.status as string,
    currency: (row.currency ?? null) as string | null,
    total: Number(row.total_amount ?? 0),
    paid: (Array.isArray(row.payments) ? row.payments : [])
      .filter((payment: any) => payment.status === "confirmed")
      .reduce((sum: number, payment: any) => sum + Number(payment.amount ?? 0), 0)
  }));
}

async function fetchSettlement(supabase: SupabaseClientLike, reservationId: string) {
  const { data, error } = await supabase
    .from("settlements")
    .select("id, status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? { status: data.status as string } : null;
}

async function fetchPendingBookingRequests(supabase: SupabaseClientLike, quoteCaseId: string) {
  const { data, error } = await supabase
    .from("agency_inquiries")
    .select("id")
    .eq("related_quote_case_id", quoteCaseId)
    .eq("inquiry_type", "booking_request")
    .in("status", ["new", "in_review"]);

  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

function resolveOne(value: unknown) {
  // PostgREST 1:1 임베드는 객체 또는 단일 요소 배열로 옵니다.
  if (Array.isArray(value)) return value[0] ?? null;
  return (value as Record<string, unknown> | null) ?? null;
}

/**
 * @file 한글 책임: `finance` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import { applySearch } from "@/lib/search.mjs";
import type {
  InvoiceDetail,
  InvoiceFilters,
  InvoiceLineItem,
  InvoiceListItem,
  PaymentListItem,
  SettlementFilters,
  SettlementListItem
} from "./types";
import {
  buildPaginationMeta,
  paginationRange,
  type PaginatedResult,
  type PaginationInput
} from "@/lib/api/pagination";

type SupabaseClientLike = {
  from: (table: string) => any;
  rpc?: (name: string, args?: Record<string, unknown>) => any;
};

const invoiceListColumns =
  "id, reservation_id, invoice_no, tour_code, version_no, status, currency, total_amount, issued_at, due_date, payment_deadline, collection_timing, collection_status, deposit_required, deposit_amount, storage_path, created_at, reservations(reservation_code, quote_cases(tour_name), agency_accounts(name), expenses(id), settlements(status, final_profit_amount)), payments(id, status, amount)";

/*
 * 회계/정산 조회 레이어입니다.
 *
 * 인보이스는 예약과 연결되고, 예약에는 expenses/settlements/payments가 연결됩니다.
 * 이 파일은 회계 대시보드가 인보이스 발행액, 입금액, 미수금, 실제 비용,
 * 최종 손익을 같은 기준으로 보여주도록 DB row를 화면 model로 변환합니다.
 */
export const INVOICE_STATUSES = ["draft", "issued", "partially_paid", "paid", "void", "overdue"];
export const SETTLEMENT_STATUSES = ["draft", "review", "approved", "closed"];

export async function listInvoices(
  supabase: SupabaseClientLike,
  filters: InvoiceFilters = {}
): Promise<InvoiceListItem[]> {
  // 인보이스 목록에서는 상세 일정까지 가져오지 않고,
  // 수금/정산 상태를 판단할 수 있는 payments, expenses, settlements 요약만 함께 조회합니다.
  const status = normalizeEnum(filters.status, INVOICE_STATUSES);
  const q = normalizeSearchTerm(filters.q);

  let query = supabase
    .from("invoices")
    .select(invoiceListColumns)
    .limit(150);

  if (status) query = query.eq("status", status);
  query = applySearch(query, q, ["invoice_no"]);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapInvoiceListItem);
}

export async function listInvoicePage(
  supabase: SupabaseClientLike,
  filters: InvoiceFilters,
  pagination: PaginationInput
): Promise<PaginatedResult<InvoiceListItem>> {
  const status = normalizeEnum(filters.status, INVOICE_STATUSES);
  const q = normalizeSearchTerm(filters.q);
  const { from, to } = paginationRange(pagination);

  let query = supabase
    .from("invoices")
    .select(invoiceListColumns, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  query = applySearch(query, q, ["invoice_no", "tour_code"]);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapInvoiceListItem);
  return { items, pagination: buildPaginationMeta(pagination, count, items.length) };
}

export async function getInvoiceDetail(
  supabase: SupabaseClientLike,
  invoiceId: string
): Promise<InvoiceDetail | null> {
  // 인보이스 상세/엑셀 출력에는 라인아이템, 결제내역, 항공/일정/계좌 snapshot이 필요합니다.
  // 이 snapshot들은 발행 당시 문서 기준을 보존하기 위한 JSONB 데이터입니다.
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, reservation_id, invoice_no, tour_code, version_no, status, currency, total_amount, issued_at, due_date, payment_deadline, collection_timing, collection_status, deposit_required, deposit_amount, storage_path, bank_account_snapshot, flight_details, itinerary_snapshot, invoice_payload, created_at, reservations(reservation_code, quote_cases(tour_name), agency_accounts(name), expenses(id), settlements(status, final_profit_amount)), payments(id, status, currency, amount, received_at, method, reference_no, idempotency_key, created_at), invoice_line_items(id, line_no, description, service_date, category, currency, unit_amount, quantity, unit_label, total_amount, notes, metadata)"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return null;

  return {
    ...mapInvoiceListItem(invoice),
    payments: (invoice.payments ?? []).map(mapPaymentListItem),
    lineItems: (invoice.invoice_line_items ?? [])
      .map(mapInvoiceLineItem)
      .sort((left: InvoiceLineItem, right: InvoiceLineItem) => left.lineNo - right.lineNo),
    bankAccountSnapshot: asObject(invoice.bank_account_snapshot),
    flightDetails: asObjectArray(invoice.flight_details),
    itinerarySnapshot: asObjectArray(invoice.itinerary_snapshot),
    invoicePayload: asObject(invoice.invoice_payload)
  };
}

export async function listSettlements(
  supabase: SupabaseClientLike,
  filters: SettlementFilters = {}
): Promise<SettlementListItem[]> {
  const status = normalizeEnum(filters.status, SETTLEMENT_STATUSES);
  const q = normalizeSearchTerm(filters.q);

  /*
   * 검색어(reservation_code, tour_name, agency name)가 2단계 중첩 관계라 PostgREST 단일 쿼리로는
   * 여러 중첩 경로를 OR 검색할 수 없습니다. 예전에는 최신 150건만 가져와 JS로 필터링해서
   * 그 뒤 정산은 검색에서 누락됐습니다. DB 함수가 전체 정산을 대상으로 조인+검색+페이지네이션합니다.
   */
  if (!supabase.rpc) throw new Error("Supabase RPC client is required for settlement search");
  const { data, error } = await supabase.rpc("search_settlements", {
    p_status: status ?? null,
    p_q: q ?? null,
    p_limit: 150,
    p_offset: 0
  });
  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map(mapSettlementListItem);
}

function mapInvoiceListItem(row: any): InvoiceListItem {
  const payments = Array.isArray(row.payments) ? row.payments : [];
  // confirmed 상태만 실제 수금액으로 봅니다.
  // pending/received/review는 대시보드에서 별도 follow-up 대상으로 다룹니다.
  const confirmedPaymentTotal = payments
    .filter((payment: any) => payment.status === "confirmed")
    .reduce((total: number, payment: any) => total + Number(payment.amount ?? 0), 0);

  const settlement = Array.isArray(row.reservations?.settlements)
    ? row.reservations.settlements[0]
    : row.reservations?.settlements;

  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationCode: row.reservations?.reservation_code ?? null,
    agencyName: row.reservations?.agency_accounts?.name ?? null,
    tourName: row.reservations?.quote_cases?.tour_name ?? null,
    invoiceNo: row.invoice_no,
    tourCode: row.tour_code ?? null,
    versionNo: Number(row.version_no ?? 1),
    status: row.status,
    currency: row.currency,
    totalAmount: Number(row.total_amount),
    issuedAt: row.issued_at ?? null,
    dueDate: row.due_date ?? null,
    paymentDeadline: row.payment_deadline ?? null,
    collectionTiming: row.collection_timing ?? null,
    collectionStatus: row.collection_status ?? "unpaid",
    depositRequired: Boolean(row.deposit_required),
    depositAmount: row.deposit_amount === null || row.deposit_amount === undefined ? null : Number(row.deposit_amount),
    storagePath: row.storage_path ?? null,
    paymentCount: payments.length,
    confirmedPaymentTotal,
    expenseCount: Array.isArray(row.reservations?.expenses) ? row.reservations.expenses.length : 0,
    settlementStatus: settlement?.status ?? null,
    finalProfitAmount:
      settlement?.final_profit_amount === null || settlement?.final_profit_amount === undefined
        ? null
        : Number(settlement.final_profit_amount),
    createdAt: row.created_at
  };
}

function mapInvoiceLineItem(row: any): InvoiceLineItem {
  return {
    id: row.id,
    lineNo: Number(row.line_no ?? 1),
    description: row.description,
    serviceDate: row.service_date ?? null,
    category: row.category ?? null,
    currency: row.currency,
    unitAmount: Number(row.unit_amount ?? 0),
    quantity: Number(row.quantity ?? 1),
    unitLabel: row.unit_label ?? null,
    totalAmount: Number(row.total_amount ?? 0),
    notes: row.notes ?? null,
    metadata: asObject(row.metadata)
  };
}

function mapSettlementListItem(row: any): SettlementListItem {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationCode: row.reservations?.reservation_code ?? null,
    agencyName: row.reservations?.agency_accounts?.name ?? null,
    tourName: row.reservations?.quote_cases?.tour_name ?? null,
    status: row.status,
    totalInvoiceAmount: Number(row.total_invoice_amount ?? 0),
    totalPaymentAmount: Number(row.total_payment_amount ?? 0),
    totalExpenseAmount: Number(row.total_expense_amount ?? 0),
    totalExtraRevenueAmount: Number(row.total_extra_revenue_amount ?? 0),
    totalShoppingCommissionAmount: Number(row.total_shopping_commission_amount ?? 0),
    finalProfitAmount: Number(row.final_profit_amount ?? 0),
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at
  };
}

function mapPaymentListItem(row: any): PaymentListItem {
  return {
    id: row.id,
    status: row.status,
    currency: row.currency,
    amount: Number(row.amount ?? 0),
    receivedAt: row.received_at ?? null,
    method: row.method ?? null,
    referenceNo: row.reference_no ?? null,
    idempotencyKey: row.idempotency_key ?? null,
    createdAt: row.created_at
  };
}

function normalizeSearchTerm(value: string | undefined) {
  // 트림과 길이 상한만 적용합니다. LIKE 이스케이프·토큰 분리는 applySearch가 처리합니다.
  if (!value) return "";
  return value.trim().slice(0, 80);
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

import type {
  AgencyInvoiceDetail,
  AgencyInvoiceLineItem,
  AgencyInvoiceListItem,
  AgencyPaymentSummary,
  AgencyPassengerItem,
  AgencyQuoteListItem,
  AgencyReservationDetail,
  AgencyReservationListItem,
  AgencyReservationStatusHistoryItem,
  AgencyRoomingListItem
} from "./types";
import { convertKrwToQuoteCurrency } from "@/lib/domain/currency.mjs";
import {
  buildPaginationMeta,
  paginationRange,
  type PaginatedResult,
  type PaginationInput
} from "@/lib/api/pagination";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function listAgencyQuoteCases(
  supabase: SupabaseClientLike,
  agencyAccountId: string
): Promise<AgencyQuoteListItem[]> {
  const { data, error } = await supabase
    .from("quote_cases")
    .select(
      "id, case_code, share_id, tour_name, tour_type, status, currency, estimated_pax, start_date, end_date, created_at, quote_versions(id, version_no, status, currency, exchange_rate_to_krw, public_total_amount, sent_at, accepted_at)"
    )
    .eq("agency_account_id", agencyAccountId)
    .in("status", ["sent", "revision_requested", "accepted", "expired"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAgencyQuoteListItem);
}

/** 파트너 견적 목록은 RLS 범위 안에서 개수와 행을 함께 조회해 대량 데이터에도 일정한 응답 크기를 유지합니다. */
export async function listAgencyQuoteCasePage(
  supabase: SupabaseClientLike,
  agencyAccountId: string,
  pagination: PaginationInput
): Promise<PaginatedResult<AgencyQuoteListItem>> {
  const { from, to } = paginationRange(pagination);
  const { data, error, count } = await supabase
    .from("quote_cases")
    .select(
      "id, case_code, share_id, tour_name, tour_type, status, currency, estimated_pax, start_date, end_date, created_at, quote_versions(id, version_no, status, currency, exchange_rate_to_krw, public_total_amount, sent_at, accepted_at)",
      { count: "exact" }
    )
    .eq("agency_account_id", agencyAccountId)
    .in("status", ["sent", "revision_requested", "accepted", "expired"])
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapAgencyQuoteListItem);
  return { items, pagination: buildPaginationMeta(pagination, count, items.length) };
}

export async function listAgencyReservations(
  supabase: SupabaseClientLike,
  agencyAccountId: string
): Promise<AgencyReservationListItem[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, quote_case_id, created_at, quote_cases(case_code, tour_name), reservation_status_history(id), rooming_lists(id)"
    )
    .eq("agency_account_id", agencyAccountId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAgencyReservationListItem);
}

/** 예약 목록의 연관 건수는 목록 페이지에 필요한 최소 정보만 조회합니다. */
export async function listAgencyReservationPage(
  supabase: SupabaseClientLike,
  agencyAccountId: string,
  pagination: PaginationInput
): Promise<PaginatedResult<AgencyReservationListItem>> {
  const { from, to } = paginationRange(pagination);
  const { data, error, count } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, quote_case_id, created_at, quote_cases(case_code, tour_name), reservation_status_history(id), rooming_lists(id)",
      { count: "exact" }
    )
    .eq("agency_account_id", agencyAccountId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapAgencyReservationListItem);
  return { items, pagination: buildPaginationMeta(pagination, count, items.length) };
}

export async function getAgencyReservationDetail(
  supabase: SupabaseClientLike,
  agencyAccountId: string,
  reservationId: string
): Promise<AgencyReservationDetail | null> {
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, quote_case_id, created_at, quote_cases(case_code, tour_name), reservation_status_history(id), rooming_lists(id)"
    )
    .eq("id", reservationId)
    .eq("agency_account_id", agencyAccountId)
    .maybeSingle();

  if (reservationError) throw new Error(reservationError.message);
  if (!reservation) return null;

  const [
    { data: history, error: historyError },
    { data: roomingLists, error: roomingError },
    { data: passengers, error: passengerError }
  ] = await Promise.all([
    supabase
      .from("reservation_status_history")
      .select("id, from_status, to_status, reason, created_at")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("rooming_lists")
      .select("id, original_filename, storage_path, revision_no, parsed_status, created_at")
      .eq("reservation_id", reservationId)
      .order("revision_no", { ascending: false }),
    supabase
      .from("passengers")
      .select("id, passenger_no, full_name, gender, date_of_birth, dietary_requirements, coach_label, rooming_list_id, created_at")
      .eq("reservation_id", reservationId)
      .order("passenger_no", { ascending: true })
  ]);

  if (historyError) throw new Error(historyError.message);
  if (roomingError) throw new Error(roomingError.message);
  if (passengerError) throw new Error(passengerError.message);

  return {
    ...mapAgencyReservationListItem({
      ...reservation,
      reservation_status_history: history ?? [],
      rooming_lists: roomingLists ?? []
    }),
    statusHistory: (history ?? []).map(mapAgencyReservationStatusHistoryItem),
    roomingLists: (roomingLists ?? []).map(mapAgencyRoomingListItem),
    passengers: (passengers ?? []).map(mapAgencyPassengerItem)
  };
}

export async function listAgencyInvoices(
  supabase: SupabaseClientLike,
  agencyAccountId: string
): Promise<AgencyInvoiceListItem[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_no, tour_code, version_no, reservation_id, status, currency, total_amount, issued_at, due_date, payment_deadline, collection_timing, collection_status, deposit_required, deposit_amount, storage_path, created_at, reservations!inner(id, reservation_code, agency_account_id, quote_cases(tour_name), agency_accounts(name)), payments(id, status, amount)"
    )
    .eq("reservations.agency_account_id", agencyAccountId)
    .in("status", ["issued", "partially_paid", "paid", "overdue"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAgencyInvoiceListItem);
}

/** 발행된 파트너 인보이스만 페이지 단위로 반환하며 내부 정산 데이터는 조회하지 않습니다. */
export async function listAgencyInvoicePage(
  supabase: SupabaseClientLike,
  agencyAccountId: string,
  pagination: PaginationInput
): Promise<PaginatedResult<AgencyInvoiceListItem>> {
  const { from, to } = paginationRange(pagination);
  const { data, error, count } = await supabase
    .from("invoices")
    .select(
      "id, invoice_no, tour_code, version_no, reservation_id, status, currency, total_amount, issued_at, due_date, payment_deadline, collection_timing, collection_status, deposit_required, deposit_amount, storage_path, created_at, reservations!inner(id, reservation_code, agency_account_id, quote_cases(tour_name), agency_accounts(name)), payments(id, status, amount)",
      { count: "exact" }
    )
    .eq("reservations.agency_account_id", agencyAccountId)
    .in("status", ["issued", "partially_paid", "paid", "overdue"])
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapAgencyInvoiceListItem);
  return { items, pagination: buildPaginationMeta(pagination, count, items.length) };
}

export async function getAgencyInvoiceDetail(
  supabase: SupabaseClientLike,
  agencyAccountId: string,
  invoiceId: string
): Promise<AgencyInvoiceDetail | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_no, tour_code, version_no, reservation_id, status, currency, total_amount, issued_at, due_date, payment_deadline, collection_timing, collection_status, deposit_required, deposit_amount, storage_path, bank_account_snapshot, flight_details, itinerary_snapshot, created_at, reservations!inner(id, reservation_code, agency_account_id, quote_cases(tour_name), agency_accounts(name)), payments(id, status, currency, amount, received_at, method, created_at), invoice_line_items(id, line_no, description, service_date, category, currency, unit_amount, quantity, unit_label, total_amount, notes)"
    )
    .eq("id", invoiceId)
    .eq("reservations.agency_account_id", agencyAccountId)
    .in("status", ["issued", "partially_paid", "paid", "overdue"])
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...mapAgencyInvoiceListItem(data),
    payments: (data.payments ?? []).map(mapAgencyPaymentSummary),
    lineItems: (data.invoice_line_items ?? [])
      .map(mapAgencyInvoiceLineItem)
      .sort((left: AgencyInvoiceLineItem, right: AgencyInvoiceLineItem) => left.lineNo - right.lineNo),
    bankAccountSnapshot: asObject(data.bank_account_snapshot),
    flightDetails: asObjectArray(data.flight_details),
    itinerarySnapshot: asObjectArray(data.itinerary_snapshot)
  };
}

function mapAgencyQuoteListItem(row: any): AgencyQuoteListItem {
  const visibleVersions = (Array.isArray(row.quote_versions) ? row.quote_versions : [])
    .filter((version: any) => ["sent", "accepted", "superseded"].includes(version.status))
    .sort((left: any, right: any) => Number(right.version_no) - Number(left.version_no));
  const latestVersion = visibleVersions[0];
  const latestCurrency = latestVersion?.currency ?? row.currency;
  const publicTotalAmount =
    latestVersion?.public_total_amount === null || latestVersion?.public_total_amount === undefined
      ? null
      : convertKrwToQuoteCurrency(
          Number(latestVersion.public_total_amount),
          Number(latestVersion.exchange_rate_to_krw ?? 1),
          latestCurrency
        );

  return {
    id: row.id,
    caseCode: row.case_code,
    shareId: row.share_id,
    tourName: row.tour_name,
    tourType: row.tour_type ?? null,
    status: row.status,
    currency: latestCurrency,
    estimatedPax: row.estimated_pax ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    latestVersionNo: latestVersion?.version_no ?? null,
    latestVersionStatus: latestVersion?.status ?? null,
    publicTotalAmount,
    sentAt: latestVersion?.sent_at ?? null,
    acceptedAt: latestVersion?.accepted_at ?? null,
    createdAt: row.created_at
  };
}

function mapAgencyReservationListItem(row: any): AgencyReservationListItem {
  return {
    id: row.id,
    reservationCode: row.reservation_code,
    status: row.status,
    tourStartDate: row.tour_start_date ?? null,
    tourEndDate: row.tour_end_date ?? null,
    quoteCaseId: row.quote_case_id,
    caseCode: row.quote_cases?.case_code ?? null,
    tourName: row.quote_cases?.tour_name ?? null,
    statusHistoryCount: Array.isArray(row.reservation_status_history) ? row.reservation_status_history.length : 0,
    roomingListCount: Array.isArray(row.rooming_lists) ? row.rooming_lists.length : 0,
    createdAt: row.created_at
  };
}

function mapAgencyReservationStatusHistoryItem(row: any): AgencyReservationStatusHistoryItem {
  return {
    id: row.id,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status,
    reason: row.reason ?? null,
    createdAt: row.created_at
  };
}

function mapAgencyRoomingListItem(row: any): AgencyRoomingListItem {
  return {
    id: row.id,
    originalFilename: row.original_filename ?? null,
    storagePath: row.storage_path ?? null,
    revisionNo: row.revision_no,
    parsedStatus: row.parsed_status,
    createdAt: row.created_at
  };
}

function mapAgencyPassengerItem(row: any): AgencyPassengerItem {
  return {
    id: row.id,
    passengerNo: row.passenger_no ?? null,
    fullName: row.full_name,
    gender: row.gender ?? null,
    dateOfBirth: row.date_of_birth ?? null,
    dietaryRequirements: row.dietary_requirements ?? null,
    coachLabel: row.coach_label ?? null,
    roomingListId: row.rooming_list_id ?? null,
    createdAt: row.created_at
  };
}

function mapAgencyPaymentSummary(row: any): AgencyPaymentSummary {
  return {
    id: row.id,
    status: row.status,
    currency: row.currency,
    amount: Number(row.amount ?? 0),
    receivedAt: row.received_at ?? null,
    method: row.method ?? null,
    createdAt: row.created_at
  };
}

function mapAgencyInvoiceListItem(row: any): AgencyInvoiceListItem {
  const payments = Array.isArray(row.payments) ? row.payments : [];
  const confirmedPaymentTotal = payments
    .filter((payment: any) => payment.status === "confirmed")
    .reduce((total: number, payment: any) => total + Number(payment.amount ?? 0), 0);

  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    reservationId: row.reservation_id,
    reservationCode: row.reservations?.reservation_code ?? null,
    agencyName: row.reservations?.agency_accounts?.name ?? null,
    tourName: row.reservations?.quote_cases?.tour_name ?? null,
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
    confirmedPaymentTotal,
    paymentCount: payments.length,
    createdAt: row.created_at
  };
}

function mapAgencyInvoiceLineItem(row: any): AgencyInvoiceLineItem {
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
    notes: row.notes ?? null
  };
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

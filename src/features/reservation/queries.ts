import type {
  ReservationDetail,
  ReservationDashboardData,
  ReservationFilters,
  ReservationListItem,
  ReservationOperationTaskItem,
  ReservationPassengerItem,
  ReservationRoomAssignmentItem,
  ReservationRoomingListItem,
  ReservationSupplierContactOption,
  ReservationSupplierOption,
  ReservationStatusHistoryItem
} from "./types";
import {
  buildPaginationMeta,
  paginationRange,
  type PaginatedResult,
  type PaginationInput
} from "@/lib/api/pagination";

type SupabaseClientLike = {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => any;
};

const reservationListColumns =
  "id, reservation_code, status, tour_start_date, tour_end_date, confirmed_at, cancelled_at, operation_ready, operation_missing, agency_account_id, quote_case_id, created_at, agency_accounts(name), quote_cases(case_code, tour_name, estimated_pax), operation_tasks(id, team, task_type, status), rooming_lists(id)";

/*
 * 예약 조회 레이어입니다.
 *
 * Reservations는 accepted quote 이후의 확정 단체 관리 화면입니다.
 * 단체현황표처럼 단체별 상태, 투어 날짜, 룸링 리스트, 오퍼레이션 task,
 * 공급사 메시지, 확정 견적 항목을 한 번에 볼 수 있도록 여러 테이블을 조합합니다.
 */
export const RESERVATION_STATUSES = [
  "pending",
  "requested",
  "confirmed",
  "on_tour",
  "completed",
  "cancelled"
];

export async function listReservations(
  supabase: SupabaseClientLike,
  filters: ReservationFilters = {}
): Promise<ReservationListItem[]> {
  // 월간 캘린더/미완료 대시보드/예약 리스트에서 쓰는 가벼운 목록 조회입니다.
  // 세부 화면에 필요한 승객/공급사/메시지 전체는 getReservationDetail에서 별도로 불러옵니다.
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, RESERVATION_STATUSES);

  let query = supabase
    .from("reservations")
    .select(reservationListColumns)
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  if (filters.agencyAccountId) {
    query = query.eq("agency_account_id", filters.agencyAccountId);
  }

  if (q) {
    query = query.or(`reservation_code.ilike.%${q}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapReservationListItem);
}

/** 운영 목록은 정렬과 검색을 DB에서 수행하고 현재 페이지 행만 반환합니다. */
export async function listReservationPage(
  supabase: SupabaseClientLike,
  filters: ReservationFilters & { sortBy?: string },
  pagination: PaginationInput
): Promise<PaginatedResult<ReservationListItem>> {
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, RESERVATION_STATUSES);
  const { from, to } = paginationRange(pagination);
  let query = supabase.from("reservations").select(reservationListColumns, { count: "exact" });

  if (status) query = query.eq("status", status);
  if (filters.agencyAccountId) query = query.eq("agency_account_id", filters.agencyAccountId);
  if (q) query = applyReservationSearch(query, q, await resolveReservationSearchScope(supabase, q));

  query = applyReservationSort(query, filters.sortBy).range(from, to);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const items = (data ?? []).map(mapReservationListItem);
  return { items, pagination: buildPaginationMeta(pagination, count, items.length) };
}

/** 선택한 달력 범위만 읽고 렌더링 상한을 둬 한 달에 단체가 급증해도 브라우저를 보호합니다. */
export async function listReservationCalendar(
  supabase: SupabaseClientLike,
  filters: ReservationFilters,
  range: { start: string; end: string; maxItems?: number }
): Promise<PaginatedResult<ReservationListItem>> {
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, RESERVATION_STATUSES);
  const pageSize = Math.min(Math.max(range.maxItems ?? 250, 1), 500);
  let query = supabase
    .from("reservations")
    .select(reservationListColumns, { count: "exact" })
    .or(
      `and(tour_start_date.lte.${range.end},tour_end_date.gte.${range.start}),` +
        `and(tour_start_date.is.null,tour_end_date.gte.${range.start},tour_end_date.lte.${range.end}),` +
        `and(tour_end_date.is.null,tour_start_date.gte.${range.start},tour_start_date.lte.${range.end})`
    );

  if (status) query = query.eq("status", status);
  if (filters.agencyAccountId) query = query.eq("agency_account_id", filters.agencyAccountId);
  if (q) query = applyReservationSearch(query, q, await resolveReservationSearchScope(supabase, q));

  const { data, error, count } = await query
    .order("tour_start_date", { ascending: true, nullsFirst: false })
    .range(0, pageSize - 1);
  if (error) throw new Error(error.message);

  const items = (data ?? []).map(mapReservationListItem);
  return {
    items,
    pagination: buildPaginationMeta({ page: 1, pageSize }, count, items.length)
  };
}

/** 대시보드 집계는 DB 함수에서 완료해 전체 예약 행을 Node 서버로 전송하지 않습니다. */
export async function getReservationDashboard(
  supabase: SupabaseClientLike,
  filters: ReservationFilters & { monthStart: string }
): Promise<ReservationDashboardData> {
  const { data, error } = await supabase.rpc("get_reservation_dashboard", {
    p_q: normalizeSearchTerm(filters.q) || null,
    p_status: normalizeEnum(filters.status, RESERVATION_STATUSES),
    p_month_start: filters.monthStart
  });
  if (error) throw new Error(error.message);
  return normalizeReservationDashboard(data);
}

export async function getReservationDetail(
  supabase: SupabaseClientLike,
  reservationId: string
): Promise<ReservationDetail | null> {
  // 예약 상세는 운영자가 바로 follow-up 할 수 있도록 여러 업무 데이터를 병렬 조회합니다.
  // status history, operation tasks, rooming, accepted quote, supplier messages가 한 화면에 필요합니다.
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, confirmed_at, cancelled_at, agency_account_id, quote_case_id, accepted_quote_version_id, created_at, agency_accounts(name), quote_cases(case_code, tour_name, estimated_pax)"
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError) {
    throw new Error(reservationError.message);
  }

  if (!reservation) {
    return null;
  }

  const [
    { data: history, error: historyError },
    { data: tasks, error: taskError },
    { data: roomingLists, error: roomingError },
    { data: passengers, error: passengerError },
    { data: roomAssignments, error: roomAssignmentError },
    { data: suppliers, error: supplierError },
    { data: acceptedQuoteVersion, error: quoteVersionError },
    { data: quoteItems, error: quoteItemError },
    { data: supplierMessages, error: supplierMessageError }
  ] =
    await Promise.all([
      supabase
        .from("reservation_status_history")
        .select("id, from_status, to_status, reason, changed_by, created_at")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("operation_tasks")
        .select("id, team, task_type, title, status, due_at, completed_at, blocked_reason, domestic_supplier_id, domestic_suppliers(name_ko)")
        .eq("reservation_id", reservationId)
        .order("due_at", { ascending: true }),
      supabase
        .from("rooming_lists")
        .select("id, original_filename, storage_path, revision_no, parsed_status, created_at")
        .eq("reservation_id", reservationId)
        .order("revision_no", { ascending: false }),
      supabase
        .from("passengers")
        .select("id, passenger_no, full_name, gender, date_of_birth, dietary_requirements, passport_no, coach_label, rooming_list_id, created_at")
        .eq("reservation_id", reservationId)
        .order("passenger_no", { ascending: true }),
      supabase
        .from("room_assignments")
        .select("id, room_no, room_type, passenger_ids, check_in, check_out, notes, rooming_list_id, created_at")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("domestic_suppliers")
        .select("id, name_ko, supplier_contacts(id, name, email, phone, receives_booking_messages, status)")
        .eq("status", "active")
        .order("name_ko", { ascending: true })
        .limit(200),
      reservation.accepted_quote_version_id
        ? supabase
            .from("quote_versions")
            .select("id, version_no, status, currency, public_total_amount, accepted_at")
            .eq("id", reservation.accepted_quote_version_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      reservation.accepted_quote_version_id
        ? supabase
            .from("quote_items")
            .select("id, item_category, service_section, snapshot_item_name, snapshot_supplier_name, pricing_unit, quantity, pax_count, total_cost_krw, total_sell_amount, partner_visible_notes, internal_notes")
            .eq("quote_version_id", reservation.accepted_quote_version_id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("supplier_message_outbox")
        .select("id, domestic_supplier_id, message_type, status, subject, approved_at, second_approved_at, sent_at, created_at, domestic_suppliers(name_ko)")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false })
    ]);

  if (historyError) throw new Error(historyError.message);
  if (taskError) throw new Error(taskError.message);
  if (roomingError) throw new Error(roomingError.message);
  if (passengerError) throw new Error(passengerError.message);
  if (roomAssignmentError) throw new Error(roomAssignmentError.message);
  if (supplierError) throw new Error(supplierError.message);
  if (quoteVersionError) throw new Error(quoteVersionError.message);
  if (quoteItemError) throw new Error(quoteItemError.message);
  if (supplierMessageError) throw new Error(supplierMessageError.message);

  const passengerItems = (passengers ?? []).map(mapReservationPassengerItem);

  return {
    ...mapReservationListItem({
      ...reservation,
      operation_tasks: tasks ?? [],
      rooming_lists: roomingLists ?? []
    }),
    acceptedQuoteVersionId: reservation.accepted_quote_version_id ?? null,
    acceptedQuoteVersion: acceptedQuoteVersion ? mapAcceptedQuoteVersion(acceptedQuoteVersion) : null,
    quoteItems: (quoteItems ?? []).map(mapReservationQuoteItem),
    supplierMessages: (supplierMessages ?? []).map(mapReservationSupplierMessageItem),
    statusHistory: (history ?? []).map(mapReservationStatusHistoryItem),
    operationTasks: (tasks ?? []).map(mapReservationOperationTaskItem),
    roomingLists: (roomingLists ?? []).map(mapReservationRoomingListItem),
    passengers: passengerItems,
    roomAssignments: (roomAssignments ?? []).map((assignment: any) =>
      mapReservationRoomAssignmentItem(assignment, passengerItems)
    ),
    supplierOptions: (suppliers ?? []).map(mapReservationSupplierOption)
  };
}

function mapReservationListItem(row: any): ReservationListItem {
  // Supabase join 결과는 snake_case와 nested relation이 섞여 있으므로
  // 화면에서는 camelCase 모델로 고정해 컴포넌트가 DB 구조에 덜 의존하게 합니다.
  return {
    id: row.id,
    reservationCode: row.reservation_code,
    status: row.status,
    tourStartDate: row.tour_start_date ?? null,
    tourEndDate: row.tour_end_date ?? null,
    confirmedAt: row.confirmed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    agencyAccountId: row.agency_account_id,
    agencyName: row.agency_accounts?.name ?? null,
    quoteCaseId: row.quote_case_id,
    caseCode: row.quote_cases?.case_code ?? null,
    tourName: row.quote_cases?.tour_name ?? null,
    estimatedPax: row.quote_cases?.estimated_pax ?? null,
    operationTaskSummary: Array.isArray(row.operation_tasks)
      ? row.operation_tasks.map((task: any) => ({
          id: task.id,
          team: task.team,
          taskType: task.task_type,
          status: task.status
        }))
      : [],
    taskCount: Array.isArray(row.operation_tasks) ? row.operation_tasks.length : 0,
    roomingListCount: Array.isArray(row.rooming_lists) ? row.rooming_lists.length : 0,
    operationReady: Boolean(row.operation_ready),
    operationMissing: Array.isArray(row.operation_missing) ? row.operation_missing.map(String) : [],
    createdAt: row.created_at
  };
}

function applyReservationSort(query: any, sortBy: string | undefined) {
  if (sortBy === "start_desc") return query.order("tour_start_date", { ascending: false, nullsFirst: false });
  if (sortBy === "incomplete_first") {
    return query
      .order("operation_ready", { ascending: true })
      .order("tour_start_date", { ascending: true, nullsFirst: false });
  }
  if (sortBy === "status") {
    return query.order("status", { ascending: true }).order("tour_start_date", { ascending: true, nullsFirst: false });
  }
  if (sortBy === "created_desc") return query.order("created_at", { ascending: false });
  return query.order("tour_start_date", { ascending: true, nullsFirst: false });
}

function applyReservationSearch(query: any, q: string, scope: { quoteCaseIds: string[]; agencyAccountIds: string[] }) {
  const clauses = [`reservation_code.ilike.%${q}%`];
  if (scope.quoteCaseIds.length > 0) clauses.push(`quote_case_id.in.(${scope.quoteCaseIds.join(",")})`);
  if (scope.agencyAccountIds.length > 0) clauses.push(`agency_account_id.in.(${scope.agencyAccountIds.join(",")})`);
  return query.or(clauses.join(","));
}

async function resolveReservationSearchScope(supabase: SupabaseClientLike, q: string) {
  const [{ data: quoteCases, error: quoteError }, { data: agencies, error: agencyError }] = await Promise.all([
    supabase.from("quote_cases").select("id").or(`case_code.ilike.%${q}%,tour_name.ilike.%${q}%`).limit(250),
    supabase.from("agency_accounts").select("id").ilike("name", `%${q}%`).limit(250)
  ]);
  if (quoteError) throw new Error(quoteError.message);
  if (agencyError) throw new Error(agencyError.message);
  return {
    quoteCaseIds: (quoteCases ?? []).map((row: any) => String(row.id)),
    agencyAccountIds: (agencies ?? []).map((row: any) => String(row.id))
  };
}

function normalizeReservationDashboard(value: any): ReservationDashboardData {
  const metrics = value?.metrics ?? {};
  const summaries = value?.summaries ?? {};
  const rows = (items: unknown) =>
    (Array.isArray(items) ? items : []).map((item: any) => ({
      label: String(item.label ?? "Unspecified"),
      groups: Number(item.groups ?? 0),
      pax: Number(item.pax ?? 0)
    }));
  return {
    metrics: {
      totalGroups: Number(metrics.totalGroups ?? 0),
      activeGroups: Number(metrics.activeGroups ?? 0),
      totalPax: Number(metrics.totalPax ?? 0),
      incompleteGroups: Number(metrics.incompleteGroups ?? 0),
      unscheduledGroups: Number(metrics.unscheduledGroups ?? 0)
    },
    summaries: {
      monthly: rows(summaries.monthly),
      weekly: rows(summaries.weekly),
      yearly: rows(summaries.yearly),
      partner: rows(summaries.partner),
      country: rows(summaries.country)
    }
  };
}

function mapReservationStatusHistoryItem(row: any): ReservationStatusHistoryItem {
  return {
    id: row.id,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status,
    reason: row.reason ?? null,
    changedBy: row.changed_by ?? null,
    createdAt: row.created_at
  };
}

function mapReservationOperationTaskItem(row: any): ReservationOperationTaskItem {
  return {
    id: row.id,
    team: row.team,
    taskType: row.task_type,
    title: row.title,
    status: row.status,
    dueAt: row.due_at ?? null,
    completedAt: row.completed_at ?? null,
    blockedReason: row.blocked_reason ?? null,
    domesticSupplierId: row.domestic_supplier_id ?? null,
    domesticSupplierName: row.domestic_suppliers?.name_ko ?? null
  };
}

function mapAcceptedQuoteVersion(row: any) {
  return {
    id: row.id,
    versionNo: row.version_no,
    status: row.status,
    currency: row.currency,
    publicTotalAmount: Number(row.public_total_amount ?? 0),
    acceptedAt: row.accepted_at ?? null
  };
}

function mapReservationQuoteItem(row: any) {
  return {
    id: row.id,
    itemCategory: row.item_category,
    serviceSection: row.service_section ?? null,
    snapshotItemName: row.snapshot_item_name,
    snapshotSupplierName: row.snapshot_supplier_name ?? null,
    pricingUnit: row.pricing_unit,
    quantity: Number(row.quantity ?? 0),
    paxCount: row.pax_count ?? null,
    totalCostKrw: Number(row.total_cost_krw ?? 0),
    totalSellAmount: Number(row.total_sell_amount ?? 0),
    partnerVisibleNotes: row.partner_visible_notes ?? null,
    internalNotes: row.internal_notes ?? null
  };
}

function mapReservationSupplierMessageItem(row: any) {
  return {
    id: row.id,
    domesticSupplierId: row.domestic_supplier_id,
    domesticSupplierName: row.domestic_suppliers?.name_ko ?? null,
    messageType: row.message_type,
    status: row.status,
    subject: row.subject ?? null,
    approvedAt: row.approved_at ?? null,
    secondApprovedAt: row.second_approved_at ?? null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at
  };
}

function mapReservationRoomingListItem(row: any): ReservationRoomingListItem {
  return {
    id: row.id,
    originalFilename: row.original_filename ?? null,
    storagePath: row.storage_path ?? null,
    revisionNo: row.revision_no,
    parsedStatus: row.parsed_status,
    createdAt: row.created_at
  };
}

function mapReservationPassengerItem(row: any): ReservationPassengerItem {
  return {
    id: row.id,
    passengerNo: row.passenger_no ?? null,
    fullName: row.full_name,
    gender: row.gender ?? null,
    dateOfBirth: row.date_of_birth ?? null,
    dietaryRequirements: row.dietary_requirements ?? null,
    passportNo: row.passport_no ?? null,
    coachLabel: row.coach_label ?? null,
    roomingListId: row.rooming_list_id ?? null,
    createdAt: row.created_at
  };
}

function mapReservationRoomAssignmentItem(
  row: any,
  passengers: ReservationPassengerItem[]
): ReservationRoomAssignmentItem {
  const passengerIds = Array.isArray(row.passenger_ids) ? row.passenger_ids.map((id: unknown) => String(id)) : [];
  const passengerNameById = new Map(passengers.map((passenger) => [passenger.id, passenger.fullName]));
  return {
    id: row.id,
    roomNo: row.room_no ?? null,
    roomType: row.room_type,
    passengerIds,
    passengerNames: passengerIds.map((id: string) => passengerNameById.get(id) ?? id),
    checkIn: row.check_in ?? null,
    checkOut: row.check_out ?? null,
    notes: row.notes ?? null,
    roomingListId: row.rooming_list_id ?? null,
    createdAt: row.created_at
  };
}

function mapReservationSupplierOption(row: any): ReservationSupplierOption {
  return {
    id: row.id,
    nameKo: row.name_ko,
    contacts: (row.supplier_contacts ?? [])
      .filter((contact: any) => contact.status === "active" && contact.receives_booking_messages)
      .map(mapReservationSupplierContactOption)
  };
}

function mapReservationSupplierContactOption(row: any): ReservationSupplierContactOption {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null
  };
}

function normalizeSearchTerm(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

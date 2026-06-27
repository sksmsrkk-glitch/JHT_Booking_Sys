import type {
  ReservationDetail,
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

type SupabaseClientLike = {
  from: (table: string) => any;
};

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
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, RESERVATION_STATUSES);

  let query = supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, confirmed_at, cancelled_at, agency_account_id, quote_case_id, created_at, agency_accounts(name), quote_cases(case_code, tour_name), operation_tasks(id), rooming_lists(id)"
    )
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

export async function getReservationDetail(
  supabase: SupabaseClientLike,
  reservationId: string
): Promise<ReservationDetail | null> {
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, confirmed_at, cancelled_at, agency_account_id, quote_case_id, accepted_quote_version_id, created_at, agency_accounts(name), quote_cases(case_code, tour_name)"
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
    { data: suppliers, error: supplierError }
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
        .limit(200)
    ]);

  if (historyError) throw new Error(historyError.message);
  if (taskError) throw new Error(taskError.message);
  if (roomingError) throw new Error(roomingError.message);
  if (passengerError) throw new Error(passengerError.message);
  if (roomAssignmentError) throw new Error(roomAssignmentError.message);
  if (supplierError) throw new Error(supplierError.message);

  const passengerItems = (passengers ?? []).map(mapReservationPassengerItem);

  return {
    ...mapReservationListItem({
      ...reservation,
      operation_tasks: tasks ?? [],
      rooming_lists: roomingLists ?? []
    }),
    acceptedQuoteVersionId: reservation.accepted_quote_version_id ?? null,
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
    taskCount: Array.isArray(row.operation_tasks) ? row.operation_tasks.length : 0,
    roomingListCount: Array.isArray(row.rooming_lists) ? row.rooming_lists.length : 0,
    createdAt: row.created_at
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

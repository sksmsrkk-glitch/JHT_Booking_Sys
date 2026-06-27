import type { OperationTaskFilters, OperationTaskListItem } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const OPERATION_TASK_STATUSES = ["todo", "blocked", "in_progress", "done", "cancelled"];
export const OPERATION_TEAMS = [
  "sales",
  "operations",
  "hotel_booking",
  "vehicle_booking",
  "guide_assignment",
  "content_booking",
  "finance"
];

export async function listOperationTasks(
  supabase: SupabaseClientLike,
  filters: OperationTaskFilters = {}
): Promise<OperationTaskListItem[]> {
  const team = normalizeEnum(filters.team, OPERATION_TEAMS);
  const status = normalizeEnum(filters.status, OPERATION_TASK_STATUSES);
  const q = normalizeSearchTerm(filters.q);

  let query = supabase
    .from("operation_tasks")
    .select(
      "id, reservation_id, domestic_supplier_id, team, task_type, title, status, due_at, completed_at, blocked_reason, created_at, reservations(reservation_code, quote_cases(tour_name), agency_accounts(name)), domestic_suppliers(name_ko), operation_reminder_logs(id)"
    )
    .limit(150);

  if (team) {
    query = query.eq("team", team);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,task_type.ilike.%${q}%`);
  }

  const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapOperationTaskListItem);
}

function mapOperationTaskListItem(row: any): OperationTaskListItem {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationCode: row.reservations?.reservation_code ?? null,
    agencyName: row.reservations?.agency_accounts?.name ?? null,
    tourName: row.reservations?.quote_cases?.tour_name ?? null,
    team: row.team,
    taskType: row.task_type,
    title: row.title,
    status: row.status,
    dueAt: row.due_at ?? null,
    completedAt: row.completed_at ?? null,
    blockedReason: row.blocked_reason ?? null,
    domesticSupplierId: row.domestic_supplier_id ?? null,
    domesticSupplierName: row.domestic_suppliers?.name_ko ?? null,
    reminderCount: Array.isArray(row.operation_reminder_logs) ? row.operation_reminder_logs.length : 0,
    createdAt: row.created_at
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

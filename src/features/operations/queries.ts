/**
 * @file 한글 책임: `operations` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import { applySearch } from "@/lib/search.mjs";
import type { NotificationListItem, OperationTaskFilters, OperationTaskListItem } from "./types";

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

  query = applySearch(query, q, ["title", "task_type"]);

  const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapOperationTaskListItem);
}

export const NOTIFICATION_ACTIVE_STATUSES = ["queued", "sent"];

/*
 * 운영 리마인더는 notifications에 큐잉만 되고 소비되는 화면이 없어 사실상 어디에도
 * 도달하지 않았습니다. 이 조회로 내부 운영자가 대기 중 알림을 실제로 확인합니다.
 */
export async function listRecentNotifications(
  supabase: SupabaseClientLike,
  options: { limit?: number; activeOnly?: boolean } = {}
): Promise<NotificationListItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  let query = supabase
    .from("notifications")
    .select(
      "id, title, body, channel, status, operation_task_id, created_at, operation_tasks(title, reservations(reservation_code))"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.activeOnly) {
    query = query.in("status", NOTIFICATION_ACTIVE_STATUSES);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapNotificationListItem);
}

function mapNotificationListItem(row: any): NotificationListItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? null,
    channel: row.channel,
    status: row.status,
    operationTaskId: row.operation_task_id ?? null,
    taskTitle: row.operation_tasks?.title ?? null,
    reservationCode: row.operation_tasks?.reservations?.reservation_code ?? null,
    createdAt: row.created_at
  };
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
  // 트림과 길이 상한만 적용합니다. LIKE 이스케이프·토큰 분리는 applySearch가 처리합니다.
  if (!value) return "";
  return value.trim().slice(0, 80);
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

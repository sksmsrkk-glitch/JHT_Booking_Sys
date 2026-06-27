import type { ApiLogFilters, ApiLogListItem, AuditLogFilters, AuditLogListItem } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const RISK_LEVELS = ["normal", "high"];

export async function listAuditLogs(
  supabase: SupabaseClientLike,
  filters: AuditLogFilters = {}
): Promise<AuditLogListItem[]> {
  const riskLevel = normalizeEnum(filters.riskLevel, RISK_LEVELS);
  const entityTable = normalizeSearchTerm(filters.entityTable);
  const action = normalizeSearchTerm(filters.action);

  let query = supabase
    .from("audit_logs")
    .select(
      "id, actor_profile_id, action, entity_table, entity_id, risk_level, before_data, after_data, approval_data, request_id, created_at, profiles(email)"
    )
    .limit(200);

  if (riskLevel) query = query.eq("risk_level", riskLevel);
  if (entityTable) query = query.eq("entity_table", entityTable);
  if (action) query = query.ilike("action", `%${action}%`);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAuditLogListItem);
}

export async function listApiLogs(
  supabase: SupabaseClientLike,
  filters: ApiLogFilters = {}
): Promise<ApiLogListItem[]> {
  const source = normalizeSearchTerm(filters.source);
  const endpoint = normalizeSearchTerm(filters.endpoint);
  const status = normalizeStatus(filters.status);

  let query = supabase
    .from("api_logs")
    .select("id, source, endpoint, method, status_code, request_payload, response_payload, idempotency_key, created_at")
    .limit(200);

  if (source) query = query.ilike("source", `%${source}%`);
  if (endpoint) query = query.ilike("endpoint", `%${endpoint}%`);
  if (status) {
    if (status === "success") query = query.gte("status_code", 200).lt("status_code", 400);
    if (status === "error") query = query.gte("status_code", 400);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapApiLogListItem);
}

function mapAuditLogListItem(row: any): AuditLogListItem {
  return {
    id: row.id,
    actorProfileId: row.actor_profile_id ?? null,
    actorEmail: row.profiles?.email ?? null,
    action: row.action,
    entityTable: row.entity_table,
    entityId: row.entity_id ?? null,
    riskLevel: row.risk_level,
    hasBeforeData: row.before_data !== null,
    hasAfterData: row.after_data !== null,
    hasApprovalData: row.approval_data !== null,
    requestId: row.request_id ?? null,
    createdAt: row.created_at
  };
}

function mapApiLogListItem(row: any): ApiLogListItem {
  return {
    id: row.id,
    source: row.source,
    endpoint: row.endpoint ?? null,
    method: row.method ?? null,
    statusCode: row.status_code ?? null,
    idempotencyKey: row.idempotency_key ?? null,
    hasRequestPayload: row.request_payload !== null,
    hasResponsePayload: row.response_payload !== null,
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

function normalizeStatus(value: string | undefined) {
  if (!value) return null;
  return ["success", "error"].includes(value) ? value : null;
}

/**
 * @file 한글 책임: `migration` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import type { MigrationBatchListItem, MigrationFilters } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const MIGRATION_STATUSES = ["uploaded", "mapped", "validated", "approved", "imported", "failed"];
export const NOTION_CSV_TARGET_TABLES = [
  "agency_accounts",
  "agency_contacts",
  "domestic_suppliers",
  "supplier_contacts",
  "supplier_products",
  "supplier_prices",
  "supplier_media"
];

export async function listMigrationBatches(
  supabase: SupabaseClientLike,
  filters: MigrationFilters = {}
): Promise<MigrationBatchListItem[]> {
  const status = normalizeEnum(filters.status, MIGRATION_STATUSES);
  const targetTable = normalizeEnum(filters.targetTable, NOTION_CSV_TARGET_TABLES);

  let query = supabase
    .from("migration_batches")
    .select(
      "id, source_name, source_kind, target_table, status, created_at, updated_at, staging_rows(id), migration_errors(id)"
    )
    .limit(100);

  if (status) query = query.eq("status", status);
  if (targetTable) query = query.eq("target_table", targetTable);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMigrationBatchListItem);
}

function mapMigrationBatchListItem(row: any): MigrationBatchListItem {
  return {
    id: row.id,
    sourceName: row.source_name,
    sourceKind: row.source_kind,
    targetTable: row.target_table,
    status: row.status,
    rowCount: Array.isArray(row.staging_rows) ? row.staging_rows.length : 0,
    errorCount: Array.isArray(row.migration_errors) ? row.migration_errors.length : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

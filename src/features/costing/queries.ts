/**
 * @file 한글 책임: `costing` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import type { CostSearchItem } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type CostItemSearchFilters = {
  q?: string | null;
  category?: string | null;
  region?: string | null;
  limit?: number;
};

/** 활성 공급사 원가만 검색하며 화면과 API가 동일한 필터 규칙을 사용하도록 중앙화합니다. */
export async function searchCostItems(
  supabase: SupabaseClientLike,
  filters: CostItemSearchFilters = {}
): Promise<CostSearchItem[]> {
  const q = normalizeSearchTerm(filters.q);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  let query = supabase
    .from("supplier_products")
    .select("id, domestic_supplier_id, product_type, name_ko, name_en, search_name, description, capacity, room_type, breakfast_included, vehicle_seat_count, menu_tags, domestic_suppliers!inner(id, category, name_ko, name_en, region_level1, region_level2, google_place_id, naver_map_url, status), supplier_prices(id, pricing_unit, currency, cost_amount, min_pax, max_pax, season_label, valid_from, valid_to, weekday_rule, includes_tax, status)")
    .eq("status", "active")
    .eq("domestic_suppliers.status", "active")
    .limit(limit);

  if (q) query = query.or(`search_name.ilike.%${q}%,name_ko.ilike.%${q}%,name_en.ilike.%${q}%`);
  if (filters.category) query = query.eq("domestic_suppliers.category", filters.category);
  if (filters.region) query = query.eq("domestic_suppliers.region_level1", filters.region);

  const { data, error } = await query.order("search_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CostSearchItem[];
}

function normalizeSearchTerm(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

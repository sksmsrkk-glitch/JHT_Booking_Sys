import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const q = normalizeSearchTerm(url.searchParams.get("q"));
    const category = url.searchParams.get("category");
    const region = url.searchParams.get("region");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    let query = supabase
      .from("supplier_products")
      .select("id, domestic_supplier_id, product_type, name_ko, name_en, search_name, description, capacity, room_type, breakfast_included, vehicle_seat_count, menu_tags, domestic_suppliers!inner(id, category, name_ko, name_en, region_level1, region_level2, google_place_id, naver_map_url, status), supplier_prices(id, pricing_unit, currency, cost_amount, min_pax, max_pax, season_label, valid_from, valid_to, weekday_rule, includes_tax, status)")
      .eq("status", "active")
      .eq("domestic_suppliers.status", "active")
      .limit(limit);

    if (q) {
      query = query.or(`search_name.ilike.%${q}%,name_ko.ilike.%${q}%,name_en.ilike.%${q}%`);
    }

    if (category) {
      query = query.eq("domestic_suppliers.category", category);
    }

    if (region) {
      query = query.eq("domestic_suppliers.region_level1", region);
    }

    const { data, error } = await query.order("search_name", { ascending: true });
    if (error) throw new HttpError(500, error.message);
    return ok(data ?? []);
  } catch (error) {
    return fail(error);
  }
}

function normalizeSearchTerm(value: string | null) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

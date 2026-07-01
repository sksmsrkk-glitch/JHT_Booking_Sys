import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { buildSupplierExportWorkbook, supplierRowsFromDatabase } from "@/lib/domain/supplier-excel.mjs";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const { data, error } = await supabase
      .from("domestic_suppliers")
      .select(
        "id, category, name_ko, name_en, search_keywords, region_level1, region_level2, address, phone, website, internal_notes, supplier_products(id, product_type, name_ko, name_en, search_name, description, capacity, room_type, breakfast_included, vehicle_seat_count, menu_tags, supplier_prices(id, pricing_unit, currency, cost_amount, min_pax, max_pax, season_label, valid_from, valid_to, weekday_rule, includes_tax, notes), supplier_media(id, storage_path, image_url, public_label, alt_text, sort_order, media_type))"
      )
      .order("name_ko", { ascending: true });

    if (error) throw new HttpError(500, error.message);
    const rows = supplierRowsFromDatabase(data ?? []);
    const workbook = buildSupplierExportWorkbook(rows);

    return new Response(workbook, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="jht-domestic-suppliers-export.xlsx"'
      }
    });
  } catch (error) {
    return fail(error);
  }
}

/**
 * @file 한글 책임: `/api/domestic-suppliers/export-xlsx` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
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

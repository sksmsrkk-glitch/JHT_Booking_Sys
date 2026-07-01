import { requireInternalUser } from "@/lib/api/auth";
import { fail } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { buildSupplierTemplateWorkbook } from "@/lib/domain/supplier-excel.mjs";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);
    const workbook = buildSupplierTemplateWorkbook();
    return new Response(workbook, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="jht-domestic-suppliers-template.xlsx"'
      }
    });
  } catch (error) {
    return fail(error);
  }
}

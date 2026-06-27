import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { getDomesticSupplierDetail } from "@/features/supplier/queries";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const { id } = await context.params;
    const supplier = await getDomesticSupplierDetail(supabase, id);
    if (!supplier) {
      throw new HttpError(404, "Domestic supplier not found");
    }

    return ok(supplier);
  } catch (error) {
    return fail(error);
  }
}

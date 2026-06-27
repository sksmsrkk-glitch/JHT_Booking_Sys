import { getSupplierMessageDetail } from "@/features/supplier-comms/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const messageId = requireUuid(id, "id");
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const message = await getSupplierMessageDetail(supabase, messageId);
    if (!message) throw new HttpError(404, "Supplier message not found");

    return ok(message);
  } catch (error) {
    return fail(error);
  }
}

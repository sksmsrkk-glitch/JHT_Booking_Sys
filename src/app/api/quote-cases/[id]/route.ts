import { getQuoteCaseDetail } from "@/features/quotation/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const quoteCase = await getQuoteCaseDetail(supabase, id);
    if (!quoteCase) throw new HttpError(404, "Quote case not found");

    return ok(quoteCase);
  } catch (error) {
    return fail(error);
  }
}

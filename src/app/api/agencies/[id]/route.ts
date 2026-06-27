import { getAgencyAccountDetail } from "@/features/agency/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const { id } = await context.params;
    const agency = await getAgencyAccountDetail(supabase, id);
    if (!agency) {
      throw new HttpError(404, "Overseas agency not found");
    }

    return ok(agency);
  } catch (error) {
    return fail(error);
  }
}

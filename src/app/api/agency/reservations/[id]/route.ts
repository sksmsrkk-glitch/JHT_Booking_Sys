import { getAgencyReservationDetail } from "@/features/agency-portal/queries";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);

    const reservation = await getAgencyReservationDetail(supabase, agencyUser.agencyAccountId, id);
    if (!reservation) throw new HttpError(404, "Reservation not found");

    return ok(reservation);
  } catch (error) {
    return fail(error);
  }
}

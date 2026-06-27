import { listAgencyReservations } from "@/features/agency-portal/queries";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const reservations = await listAgencyReservations(supabase, agencyUser.agencyAccountId);
    return ok(reservations);
  } catch (error) {
    return fail(error);
  }
}

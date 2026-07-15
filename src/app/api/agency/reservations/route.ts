import { listAgencyReservationPage } from "@/features/agency-portal/queries";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, okPaginated } from "@/lib/api/http";
import { parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/agency/reservations", async (request: Request) => {
  try {
    const pagination = parsePagination(new URL(request.url).searchParams);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const reservations = await listAgencyReservationPage(supabase, agencyUser.agencyAccountId, pagination);
    return okPaginated(reservations.items, reservations.pagination);
  } catch (error) {
    return fail(error);
  }
});

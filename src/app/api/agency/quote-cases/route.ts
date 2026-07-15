import { listAgencyQuoteCasePage } from "@/features/agency-portal/queries";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, okPaginated } from "@/lib/api/http";
import { parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/agency/quote-cases", async (request: Request) => {
  try {
    const pagination = parsePagination(new URL(request.url).searchParams);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const quoteCases = await listAgencyQuoteCasePage(supabase, agencyUser.agencyAccountId, pagination);
    return okPaginated(quoteCases.items, quoteCases.pagination);
  } catch (error) {
    return fail(error);
  }
});

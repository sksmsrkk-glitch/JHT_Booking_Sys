import { listAgencyInvoicePage } from "@/features/agency-portal/queries";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, okPaginated } from "@/lib/api/http";
import { parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/agency/invoices", async (request: Request) => {
  try {
    const pagination = parsePagination(new URL(request.url).searchParams);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const invoices = await listAgencyInvoicePage(supabase, agencyUser.agencyAccountId, pagination);
    return okPaginated(invoices.items, invoices.pagination);
  } catch (error) {
    return fail(error);
  }
});

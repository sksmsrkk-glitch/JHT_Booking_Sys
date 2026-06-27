import { listAgencyInvoices } from "@/features/agency-portal/queries";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const invoices = await listAgencyInvoices(supabase, agencyUser.agencyAccountId);
    return ok(invoices);
  } catch (error) {
    return fail(error);
  }
}

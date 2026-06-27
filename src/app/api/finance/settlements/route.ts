import { listSettlements } from "@/features/finance/queries";
import { requireFinanceUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireFinanceUser(supabase);

    const url = new URL(request.url);
    const settlements = await listSettlements(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    });

    return ok(settlements);
  } catch (error) {
    return fail(error);
  }
}

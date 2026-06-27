import { listApiLogs } from "@/features/audit/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const logs = await listApiLogs(supabase, {
      source: url.searchParams.get("source") ?? undefined,
      endpoint: url.searchParams.get("endpoint") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    });

    return ok(logs);
  } catch (error) {
    return fail(error);
  }
}

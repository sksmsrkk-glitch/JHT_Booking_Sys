import { listAuditLogs } from "@/features/audit/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const logs = await listAuditLogs(supabase, {
      riskLevel: url.searchParams.get("riskLevel") ?? undefined,
      entityTable: url.searchParams.get("entityTable") ?? undefined,
      action: url.searchParams.get("action") ?? undefined
    });

    return ok(logs);
  } catch (error) {
    return fail(error);
  }
}

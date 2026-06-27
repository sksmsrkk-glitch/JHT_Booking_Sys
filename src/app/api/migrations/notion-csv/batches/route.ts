import { listMigrationBatches } from "@/features/migration/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const batches = await listMigrationBatches(supabase, {
      status: url.searchParams.get("status") ?? undefined,
      targetTable: url.searchParams.get("targetTable") ?? undefined
    });

    return ok(batches);
  } catch (error) {
    return fail(error);
  }
}

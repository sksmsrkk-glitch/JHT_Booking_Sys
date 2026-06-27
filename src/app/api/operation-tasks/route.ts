import { listOperationTasks } from "@/features/operations/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const tasks = await listOperationTasks(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      team: url.searchParams.get("team") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    });

    return ok(tasks);
  } catch (error) {
    return fail(error);
  }
}

import { listFailedAutomationJobs } from "@/features/automation/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const jobs = await listFailedAutomationJobs(supabase);
    return ok(jobs);
  } catch (error) {
    return fail(error);
  }
}

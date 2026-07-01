import { demoWorkflowThreads } from "@/features/workflow/demo-data";
import { listWorkflowThreads } from "@/features/workflow/queries";
import { requireAgencyUser, requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    if (!request.headers.get("authorization")) {
      return ok(demoWorkflowThreads.map(({ messages, actionItems, linkedDocs, ...thread }) => ({ ...thread, preview: true })));
    }

    const supabase = createRequestSupabaseClient(request);
    const actor = await resolveActor(supabase);
    const workflows = await listWorkflowThreads(supabase, {
      agencyAccountId: actor.type === "agency" ? actor.agencyAccountId : undefined,
      limit: 100
    });
    return ok(workflows);
  } catch (error) {
    return fail(error);
  }
}

async function resolveActor(supabase: any) {
  try {
    await requireInternalUser(supabase);
    return { type: "internal" as const, agencyAccountId: undefined };
  } catch {
    const agencyUser = await requireAgencyUser(supabase);
    return { type: "agency" as const, agencyAccountId: agencyUser.agencyAccountId };
  }
}

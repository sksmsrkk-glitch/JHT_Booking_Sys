import { demoWorkflowThreads } from "@/features/workflow/demo-data";
import { filterWorkflowSummaries, normalizeWorkflowFilters } from "@/features/workflow/filters";
import { listWorkflowThreads } from "@/features/workflow/queries";
import { requireAgencyUser, requireInternalUser } from "@/lib/api/auth";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { HttpError } from "@/lib/api/http";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const filters = normalizeWorkflowFilters(Object.fromEntries(new URL(request.url).searchParams));

    const supabase = createRequestSupabaseClient(request);
    let actor;
    try {
      actor = await resolveActor(supabase);
    } catch (error) {
      if (!isDemoModeEnabled()) throw error;
      const demoSummaries = demoWorkflowThreads.map(({ messages, actionItems, linkedDocs, ...thread }) => thread);
      return ok(filterWorkflowSummaries(demoSummaries, filters).map((thread) => ({ ...thread, preview: true })));
    }
    const workflows = await listWorkflowThreads(supabase, {
      agencyAccountId: actor.type === "agency" ? actor.agencyAccountId : undefined,
      filters,
      limit: 500
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
  } catch (error) {
    if (!(error instanceof HttpError) || ![401, 403].includes(error.status)) throw error;
    const agencyUser = await requireAgencyUser(supabase);
    return { type: "agency" as const, agencyAccountId: agencyUser.agencyAccountId };
  }
}

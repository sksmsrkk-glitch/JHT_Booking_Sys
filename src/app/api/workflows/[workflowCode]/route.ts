import { getDemoWorkflowByCode } from "@/features/workflow/demo-data";
import { ensureWorkflowThread, getWorkflowThreadByCode, resolveWorkflowSeedByCode } from "@/features/workflow/queries";
import { requireAgencyUser, requireInternalUser } from "@/lib/api/auth";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workflowCode: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { workflowCode } = await context.params;
    const demo = getDemoWorkflowByCode(workflowCode);
    const supabase = createRequestSupabaseClient(request);
    let actor;
    try {
      actor = await resolveActor(supabase);
    } catch (error) {
      if (isDemoModeEnabled()) return ok(demo ? { ...demo, preview: true } : null);
      throw error;
    }
    const partnerVisibleOnly = actor.type === "agency";
    const existing = await getWorkflowThreadByCode(supabase, workflowCode, { partnerVisibleOnly });
    if (existing) return ok(existing);

    const seed = await resolveWorkflowSeedByCode(supabase, workflowCode);
    if (!seed) return ok(demo ? { ...demo, preview: true } : null);
    if (actor.type === "agency" && seed.agencyAccountId !== actor.agencyAccountId) {
      throw new HttpError(403, "Workflow does not belong to this agency");
    }

    const created = await ensureWorkflowThread(supabase, { ...seed, createdBy: actor.profileId });
    return ok(created);
  } catch (error) {
    return fail(error);
  }
}

async function resolveActor(supabase: any) {
  try {
    const internalUser = await requireInternalUser(supabase);
    return { type: "internal" as const, profileId: internalUser.profileId, agencyAccountId: null };
  } catch (error) {
    if (!(error instanceof HttpError) || ![401, 403].includes(error.status)) throw error;
    const agencyUser = await requireAgencyUser(supabase);
    return {
      type: "agency" as const,
      profileId: null,
      agencyAccountId: agencyUser.agencyAccountId
    };
  }
}

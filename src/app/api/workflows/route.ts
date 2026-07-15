import { demoWorkflowThreads } from "@/features/workflow/demo-data";
import { filterWorkflowSummaries, normalizeWorkflowFilters } from "@/features/workflow/filters";
import { listWorkflowThreadPage } from "@/features/workflow/queries";
import { requireAgencyUser, requireInternalUser } from "@/lib/api/auth";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { HttpError } from "@/lib/api/http";
import { fail, ok, okPaginated } from "@/lib/api/http";
import { buildPaginationMeta, parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/workflows", async (request: Request) => {
  try {
    const url = new URL(request.url);
    const filters = normalizeWorkflowFilters(Object.fromEntries(url.searchParams));
    const pagination = parsePagination(url.searchParams);

    const supabase = createRequestSupabaseClient(request);
    let actor;
    try {
      actor = await resolveActor(supabase);
    } catch (error) {
      if (!isDemoModeEnabled()) throw error;
      const demoSummaries = demoWorkflowThreads.map(({ messages, actionItems, linkedDocs, ...thread }) => thread);
      const filtered = filterWorkflowSummaries(demoSummaries, filters);
      const from = (pagination.page - 1) * pagination.pageSize;
      const items = filtered.slice(from, from + pagination.pageSize).map((thread) => ({ ...thread, preview: true }));
      return okPaginated(items, buildPaginationMeta(pagination, filtered.length, items.length));
    }
    const workflows = await listWorkflowThreadPage(supabase, {
      agencyAccountId: actor.type === "agency" ? actor.agencyAccountId : undefined,
      filters,
      pagination
    });
    return okPaginated(workflows.items, workflows.pagination);
  } catch (error) {
    return fail(error);
  }
});

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

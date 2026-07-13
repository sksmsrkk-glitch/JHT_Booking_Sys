import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { requireAdminUser } from "@/lib/api/auth";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const admin = await requireAdminUser(supabase);
    const { id } = await context.params;
    const requestId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const status = requireString(body.status, "status");
    if (status !== "resolved" && status !== "dismissed") {
      throw new HttpError(400, "status must be resolved or dismissed");
    }

    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() || null : null;
    const { data, error } = await supabase
      .from("account_recovery_requests")
      .update({
        status,
        resolution_note: resolutionNote,
        resolved_by: admin.profileId,
        resolved_at: new Date().toISOString()
      })
      .eq("id", requestId)
      .select("id, status, resolved_at")
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

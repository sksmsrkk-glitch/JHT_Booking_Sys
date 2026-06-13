import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: before, error: beforeError } = await supabase
      .from("operation_tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (beforeError) throw new HttpError(500, beforeError.message);

    const update: Record<string, unknown> = {};
    for (const field of ["status", "assigned_to", "due_at", "blocked_reason"] as const) {
      if (field in body) update[field] = body[field];
    }

    if (body.status === "done") {
      update.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("operation_tasks")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "operation_task.updated",
      entityTable: "operation_tasks",
      entityId: id,
      beforeData: before,
      afterData: data
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

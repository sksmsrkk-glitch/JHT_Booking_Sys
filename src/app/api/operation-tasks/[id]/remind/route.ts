import { requireInternalUser } from "@/lib/api/auth";
import { created, fail, HttpError, readJson } from "@/lib/api/http";
import { buildReminderIdempotencyKey } from "@/lib/domain/operations.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const ruleCode = String(body.ruleCode ?? "manual");
    const { data: task, error: taskError } = await supabase
      .from("operation_tasks")
      .select("id, reservation_id, assigned_to, title, status, due_at")
      .eq("id", id)
      .single();

    if (taskError) throw new HttpError(500, taskError.message);

    const { data: rule } = await supabase
      .from("operation_reminder_rules")
      .select("id, code, threshold_hours, escalation_level")
      .eq("code", ruleCode)
      .maybeSingle();

    const idempotencyKey =
      typeof body.idempotencyKey === "string"
        ? body.idempotencyKey
        : buildReminderIdempotencyKey(task, { code: ruleCode }, new Date());

    const { error: notificationError } = await supabase.from("notifications").upsert(
      {
        recipient_profile_id: task.assigned_to,
        operation_task_id: task.id,
        channel: "internal",
        title: `Reminder: ${task.title}`,
        body: body.message ?? null,
        idempotency_key: idempotencyKey,
        status: "queued"
      },
      { onConflict: "idempotency_key" }
    );

    if (notificationError) throw new HttpError(500, notificationError.message);

    const { data, error } = await supabase
      .from("operation_reminder_logs")
      .upsert(
        {
          operation_task_id: task.id,
          reminder_rule_id: rule?.id ?? null,
          channel: "internal",
          sent_to: task.assigned_to ? [task.assigned_to] : [],
          idempotency_key: idempotencyKey,
          status: "queued"
        },
        { onConflict: "idempotency_key" }
      )
      .select("id, operation_task_id, idempotency_key, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    return created(data);
  } catch (error) {
    return fail(error);
  }
}

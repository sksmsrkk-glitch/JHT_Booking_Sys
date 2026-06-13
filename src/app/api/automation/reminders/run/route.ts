import { requireAutomationSecret } from "@/lib/api/guards";
import { fail, HttpError, ok } from "@/lib/api/http";
import { buildReminderCandidates } from "@/lib/domain/operations.mjs";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type ReminderRuleRow = {
  id: string;
  code: string;
  threshold_hours: number;
  escalation_level: string;
};

export async function POST(request: Request) {
  try {
    requireAutomationSecret(request);
    const supabase = createServiceSupabaseClient();

    const { data: tasks, error: taskError } = await supabase
      .from("operation_tasks")
      .select("id, reservation_id, assigned_to, title, status, due_at")
      .not("due_at", "is", null)
      .not("status", "in", "(done,cancelled)")
      .limit(1000);

    if (taskError) throw new HttpError(500, taskError.message);

    const { data: rules, error: ruleError } = await supabase
      .from("operation_reminder_rules")
      .select("id, code, threshold_hours, escalation_level")
      .eq("active", true);

    if (ruleError) throw new HttpError(500, ruleError.message);

    const ruleRows = (rules ?? []) as ReminderRuleRow[];
    const ruleByCode = new Map(ruleRows.map((rule) => [rule.code, rule]));
    const candidates = buildReminderCandidates({
      tasks: tasks ?? [],
      rules: ruleRows.map((rule) => ({
        code: rule.code,
        thresholdHours: rule.threshold_hours,
        escalationLevel: rule.escalation_level
      }))
    });

    const taskById = new Map((tasks ?? []).map((task: any) => [task.id, task]));
    let queuedCount = 0;

    for (const candidate of candidates) {
      const task = taskById.get(candidate.taskId);
      const rule = ruleByCode.get(candidate.ruleCode);

      const { error: notificationError } = await supabase.from("notifications").upsert(
        {
          recipient_profile_id: task?.assigned_to ?? null,
          operation_task_id: candidate.taskId,
          channel: "internal",
          title: `Reminder: ${task?.title ?? "Operation task"}`,
          body: `Escalation: ${candidate.escalationLevel}`,
          idempotency_key: candidate.idempotencyKey,
          status: "queued"
        },
        { onConflict: "idempotency_key" }
      );

      if (notificationError) throw new HttpError(500, notificationError.message);

      const { error: logError } = await supabase.from("operation_reminder_logs").upsert(
        {
          operation_task_id: candidate.taskId,
          reminder_rule_id: rule?.id ?? null,
          channel: "internal",
          sent_to: task?.assigned_to ? [task.assigned_to] : [],
          idempotency_key: candidate.idempotencyKey,
          status: "queued"
        },
        { onConflict: "idempotency_key" }
      );

      if (logError) throw new HttpError(500, logError.message);
      queuedCount += 1;
    }

    return ok({ checkedTaskCount: tasks?.length ?? 0, candidateCount: candidates.length, queuedCount });
  } catch (error) {
    return fail(error);
  }
}

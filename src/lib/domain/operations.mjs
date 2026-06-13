export const OPERATION_TEAMS = [
  "sales",
  "operations",
  "hotel_booking",
  "vehicle_booking",
  "guide_assignment",
  "content_booking",
  "finance"
];

export const DEFAULT_TASK_TEMPLATES = [
  { team: "sales", taskType: "agency_final_request_check", title: "Confirm final agency request", daysBefore: 30 },
  { team: "operations", taskType: "itinerary_finalization", title: "Finalize itinerary", daysBefore: 21 },
  { team: "hotel_booking", taskType: "hotel_room_block", title: "Confirm hotel room block", daysBefore: 21 },
  { team: "vehicle_booking", taskType: "vehicle_assignment", title: "Confirm coach and vehicle assignment", daysBefore: 14 },
  { team: "guide_assignment", taskType: "guide_assignment", title: "Assign guide and share contact", daysBefore: 10 },
  { team: "content_booking", taskType: "restaurant_and_content_booking", title: "Confirm meals, attractions, and content bookings", daysBefore: 10 },
  { team: "finance", taskType: "invoice_and_deposit_check", title: "Issue invoice and check deposit", daysBefore: 7 }
];

export const DEFAULT_REMINDER_RULES = [
  { code: "due_48h", thresholdHours: 48, escalationLevel: "assignee" },
  { code: "due_24h", thresholdHours: 24, escalationLevel: "assignee_and_team_lead" },
  { code: "overdue", thresholdHours: 0, escalationLevel: "assignee_team_lead_admin" }
];

export function createDefaultOperationTasks({ reservationId, tourStartDate, createdBy }) {
  if (!reservationId) throw new Error("reservationId is required");
  if (!tourStartDate) throw new Error("tourStartDate is required");

  const start = new Date(tourStartDate);
  if (Number.isNaN(start.getTime())) throw new Error("tourStartDate is invalid");

  return DEFAULT_TASK_TEMPLATES.map((template) => {
    const dueAt = new Date(start);
    dueAt.setUTCDate(dueAt.getUTCDate() - template.daysBefore);
    return {
      reservation_id: reservationId,
      team: template.team,
      task_type: template.taskType,
      title: template.title,
      status: "todo",
      due_at: dueAt.toISOString(),
      created_by: createdBy ?? null
    };
  });
}

export function buildReminderCandidates({ tasks, now = new Date(), rules = DEFAULT_REMINDER_RULES }) {
  const nowDate = new Date(now);
  return tasks
    .filter((task) => !["done", "cancelled"].includes(task.status))
    .flatMap((task) => {
      const dueAt = new Date(task.due_at);
      const hoursUntilDue = (dueAt.getTime() - nowDate.getTime()) / 36e5;

      return rules
        .filter((rule) => shouldTriggerRule(hoursUntilDue, rule))
        .map((rule) => ({
          taskId: task.id,
          reservationId: task.reservation_id,
          ruleCode: rule.code,
          escalationLevel: rule.escalationLevel,
          idempotencyKey: buildReminderIdempotencyKey(task, rule, nowDate)
        }));
    });
}

export function shouldTriggerRule(hoursUntilDue, rule) {
  if (rule.code === "overdue") {
    return hoursUntilDue < 0;
  }

  return hoursUntilDue >= 0 && hoursUntilDue <= rule.thresholdHours;
}

export function buildReminderIdempotencyKey(task, rule, now) {
  const date = now.toISOString().slice(0, 10);
  return `${task.reservation_id}:${task.id}:${rule.code}:${date}`;
}

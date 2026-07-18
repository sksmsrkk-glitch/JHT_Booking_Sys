/**
 * @file 한글 책임: `operations` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
export const OPERATION_TEAMS = [
  "sales",
  "operations",
  "hotel_booking",
  "vehicle_booking",
  "guide_assignment",
  "content_booking",
  "finance"
];

export const OPERATION_TASK_STATUSES = ["todo", "blocked", "in_progress", "done", "cancelled"];

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

export function buildOperationTaskUpdate(input, now = new Date()) {
  const update = {};

  if ("status" in input) {
    if (!OPERATION_TASK_STATUSES.includes(input.status)) {
      throw new Error(`Unsupported operation task status: ${input.status}`);
    }
    update.status = input.status;
    if (input.status === "done") {
      update.completed_at = now.toISOString();
      update.blocked_reason = null;
    } else {
      update.completed_at = null;
    }
  }

  if ("blockedReason" in input && update.status !== "done") {
    update.blocked_reason = normalizeOptionalText(input.blockedReason);
  }

  if (update.status === "blocked" && !update.blocked_reason) {
    throw new Error("Blocked tasks require a blocked reason");
  }

  if (update.status && update.status !== "blocked" && !("blockedReason" in input)) {
    update.blocked_reason = null;
  }

  if ("dueAt" in input) {
    update.due_at = normalizeOptionalDateTime(input.dueAt);
  }

  if ("domesticSupplierId" in input) {
    update.domestic_supplier_id = normalizeOptionalText(input.domesticSupplierId);
  }

  return update;
}

export function assertReservationOperationsOpen({ reservationStatus }) {
  if (["cancelled", "completed"].includes(reservationStatus)) {
    throw new Error(`Reservation operations are locked when status is ${reservationStatus}`);
  }
  return true;
}

export function assertOperationTaskReminderAllowed({ taskStatus }) {
  if (["done", "cancelled"].includes(taskStatus)) {
    throw new Error(`Operation task reminders are locked when task status is ${taskStatus}`);
  }
  return true;
}

export function buildReminderCandidates({ tasks, now = new Date(), rules = DEFAULT_REMINDER_RULES }) {
  const nowDate = new Date(now);
  return tasks
    .filter((task) => isOperationTaskReminderAllowed(task.status))
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

export function isOperationTaskReminderAllowed(taskStatus) {
  return !["done", "cancelled"].includes(taskStatus);
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

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalDateTime(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("dueAt must be a valid date/time");
  }
  return date.toISOString();
}

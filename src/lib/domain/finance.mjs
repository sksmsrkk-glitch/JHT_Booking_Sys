/**
 * @param {{ totalAmount: number, payments?: Array<{ status: string, amount: number }> }} input
 */
export function summarizeInvoicePayments({ totalAmount, payments = [] }) {
  const total = Number(totalAmount ?? 0);
  const confirmedPaymentTotal = payments
    .filter((payment) => payment.status === "confirmed")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const pendingPaymentTotal = payments
    .filter((payment) => ["pending", "received", "review"].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return {
    totalAmount: total,
    confirmedPaymentTotal,
    pendingPaymentTotal,
    remainingAmount: Math.max(total - confirmedPaymentTotal, 0),
    isPaid: confirmedPaymentTotal >= total && total > 0
  };
}

export const SETTLEMENT_STATUSES = ["draft", "review", "approved", "closed"];

export function buildSettlementStatusUpdate({ currentStatus, nextStatus, actorProfileId }, now = new Date()) {
  if (!SETTLEMENT_STATUSES.includes(currentStatus)) {
    throw new Error(`Unsupported current settlement status: ${currentStatus}`);
  }

  if (!SETTLEMENT_STATUSES.includes(nextStatus)) {
    throw new Error(`Unsupported settlement status: ${nextStatus}`);
  }

  if (currentStatus === "closed") {
    throw new Error("Closed settlements cannot be changed");
  }

  const allowedNextStatuses = resolveAllowedSettlementTransitions(currentStatus);
  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new Error(`Settlement cannot move from ${currentStatus} to ${nextStatus}`);
  }

  const update = { status: nextStatus };
  if (nextStatus === "approved") {
    const approvedAt = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(approvedAt.getTime())) {
      throw new Error("approvedAt must be a valid date/time");
    }
    update.approved_by = requireText(actorProfileId, "actorProfileId");
    update.approved_at = approvedAt.toISOString();
  }

  return update;
}

export function assertFinanceAdjustmentAllowed({ settlementStatus }) {
  return assertFinanceEntryAllowed({ settlementStatus });
}

export function assertFinanceEntryAllowed({ settlementStatus }) {
  if (settlementStatus === "closed") {
    throw new Error("Finance entries cannot be added after settlement is closed");
  }
  return true;
}

function resolveAllowedSettlementTransitions(currentStatus) {
  if (currentStatus === "draft") return ["review", "approved"];
  if (currentStatus === "review") return ["draft", "approved"];
  if (currentStatus === "approved") return ["closed"];
  return [];
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

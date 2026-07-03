/**
 * 인보이스 입금 상태 요약 함수입니다.
 *
 * 회계 담당자는 인보이스 총액, 입금 확인액, 확인 전 입금액, 미수금을
 * 대시보드에서 바로 봐야 합니다. 이 함수는 confirmed 입금만 실제 수금으로
 * 인정하고, pending 상태는 검토 중 금액으로 별도 집계합니다.
 * (payment_status enum: pending/confirmed/failed/refunded)
 *
 * @param {{ totalAmount: number, payments?: Array<{ status: string, amount: number }> }} input
 */
export function summarizeInvoicePayments({ totalAmount, payments = [] }) {
  const total = Number(totalAmount ?? 0);
  const confirmedPaymentTotal = payments
    .filter((payment) => payment.status === "confirmed")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const pendingPaymentTotal = payments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return {
    totalAmount: total,
    confirmedPaymentTotal,
    pendingPaymentTotal,
    remainingAmount: Math.max(total - confirmedPaymentTotal, 0),
    isOverpaid: total > 0 && confirmedPaymentTotal > total,
    isPaid: confirmedPaymentTotal >= total && total > 0
  };
}

export const SETTLEMENT_STATUSES = ["draft", "review", "approved", "closed"];

export function buildSettlementStatusUpdate({ currentStatus, nextStatus, actorProfileId }, now = new Date()) {
  // 정산 상태는 돈과 연결되므로 자유롭게 변경하지 않고,
  // draft -> review/approved -> closed 흐름만 허용합니다.
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
    // 승인 시점과 승인자를 고정해 두면 이후 정산 이슈가 생겼을 때
    // 누가 어떤 금액을 승인했는지 audit trail로 확인할 수 있습니다.
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
  // closed 정산에는 비용/추가수익을 더 넣을 수 없습니다.
  // 마감 이후 수정이 필요하면 새 조정 절차를 별도로 만들어야 합니다.
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

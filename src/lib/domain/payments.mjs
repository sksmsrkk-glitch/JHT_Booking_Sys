/**
 * @file 한글 책임: `payments` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
/**
 * 결제 기록 도메인 규칙입니다.
 *
 * - idempotency_key는 호출자가 명시적으로 제공해야 합니다(타임스탬프 폴백 금지).
 *   폴백에 시각을 넣으면 이중 제출이 서로 다른 키가 되어 중복 결제를 만듭니다.
 * - 결제 통화는 인보이스 통화와 반드시 일치해야 합니다(1,300 KRW로 1,300 MYR 인보이스를
 *   결제 완료 처리하는 통화 혼동 방지).
 * - confirmed 결제 합계로 인보이스 상태(paid/partially_paid)를 재계산합니다.
 */

export const PAYMENT_STATUSES = ["pending", "confirmed", "failed", "refunded"];

/**
 * 결제 입력을 검증하고 정규화합니다.
 *
 * @param {{
 *   invoiceCurrency: string,
 *   amount: unknown,
 *   status?: unknown,
 *   currency?: unknown,
 *   idempotencyKey?: unknown,
 *   referenceNo?: unknown
 * }} input
 */
export function validatePaymentInput({ invoiceCurrency, amount, status, currency, idempotencyKey, referenceNo }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("amount must be a positive number");
  }

  const normalizedStatus =
    typeof status === "string" && PAYMENT_STATUSES.includes(status) ? status : "pending";

  const normalizedCurrency =
    typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : normalizeCurrency(invoiceCurrency);
  if (normalizedCurrency !== normalizeCurrency(invoiceCurrency)) {
    throw new Error(`Payment currency ${normalizedCurrency} does not match invoice currency ${normalizeCurrency(invoiceCurrency)}`);
  }

  const key = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  if (!key) {
    throw new Error("idempotencyKey is required");
  }

  const reference = typeof referenceNo === "string" && referenceNo.trim() ? referenceNo.trim() : null;
  if (normalizedStatus === "confirmed" && !reference) {
    throw new Error("referenceNo is required for confirmed payments");
  }

  return {
    amount: numericAmount,
    status: normalizedStatus,
    currency: normalizedCurrency,
    idempotencyKey: key,
    referenceNo: reference
  };
}

/**
 * confirmed 결제 합계로 다음 인보이스 상태를 계산합니다.
 *
 * @param {{ invoiceTotal: number|string, currentStatus: string, payments?: Array<{ status: string, amount: number|string }> }} input
 * @returns {{ confirmedTotal: number, nextStatus: string, isOverpaid: boolean }}
 */
export function resolveInvoicePaymentState({ invoiceTotal, currentStatus, payments = [] }) {
  const total = Number(invoiceTotal ?? 0);
  const confirmedTotal = payments
    .filter((payment) => payment.status === "confirmed")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  let nextStatus = currentStatus;
  if (total > 0 && confirmedTotal >= total) {
    nextStatus = "paid";
  } else if (confirmedTotal > 0) {
    nextStatus = "partially_paid";
  }

  return {
    confirmedTotal: Math.round((confirmedTotal + Number.EPSILON) * 100) / 100,
    nextStatus,
    isOverpaid: total > 0 && confirmedTotal > total
  };
}

function normalizeCurrency(value) {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "KRW";
}

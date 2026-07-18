/**
 * @file 한글 책임: `settlement` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
/**
 * 정산 집계 도메인 로직입니다.
 *
 * 두 가지 결함을 막습니다.
 *  1) 인보이스 재발행(version_no 증가)으로 생긴 이전 버전을 중복 합산 → 이익 과대계상.
 *     같은 tour_code 안에서는 가장 높은 version_no 인보이스만 유효로 봅니다.
 *  2) 서로 다른 통화를 단순 합산 → 무의미한 숫자. 통화가 섞이면 예외를 던져
 *     상위에서 명시적으로 처리하게 합니다(환율 변환 모델은 후속 작업).
 *
 * 금액은 numeric 문자열/JS number가 섞여 들어오므로 항상 Number로 정규화하고
 * 최종 저장 값은 소수 2자리로 반올림합니다.
 */

export function roundMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  // 부동소수 오차 보정을 위해 EPSILON을 더한 뒤 반올림합니다.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 같은 tour_code 그룹에서 최신 version_no 인보이스만 남깁니다.
 * tour_code가 없는 인보이스는 각각을 독립 인보이스로 취급합니다.
 *
 * @param {Array<{ id?: string, tour_code?: string|null, version_no?: number|null, total_amount?: number|string, currency?: string|null, status?: string|null }>} invoices
 */
export function selectActiveInvoices(invoices = []) {
  const latestByTour = new Map();
  const standalone = [];

  for (const invoice of invoices) {
    // void 처리된 인보이스는 정산에서 제외합니다.
    if (invoice.status === "void") continue;

    const tourCode = invoice.tour_code ?? null;
    if (!tourCode) {
      standalone.push(invoice);
      continue;
    }
    const versionNo = Number(invoice.version_no ?? 1);
    const current = latestByTour.get(tourCode);
    if (!current || versionNo > Number(current.version_no ?? 1)) {
      latestByTour.set(tourCode, invoice);
    }
  }

  return [...latestByTour.values(), ...standalone];
}

/**
 * 정산 합계를 계산합니다.
 *
 * @param {{
 *   invoices?: Array<object>,
 *   payments?: Array<{ amount: number|string, status?: string }>,
 *   expenses?: Array<{ amount: number|string, currency?: string }>,
 *   extraRevenues?: Array<{ amount: number|string, currency?: string }>,
 *   commissions?: Array<{ commission_amount: number|string, currency?: string }>
 * }} input
 */
export function computeSettlementTotals({
  invoices = [],
  payments = [],
  expenses = [],
  extraRevenues = [],
  commissions = []
} = {}) {
  const activeInvoices = selectActiveInvoices(invoices);

  // 통화 일관성 검증: 활성 인보이스와 재무 항목의 통화가 하나로 모여야
  // 합산이 의미를 가집니다. 섞이면 상위에서 환율 변환/거부를 결정하게 던집니다.
  const currencies = new Set();
  for (const invoice of activeInvoices) currencies.add(normalizeCurrency(invoice.currency));
  for (const expense of expenses) currencies.add(normalizeCurrency(expense.currency));
  for (const revenue of extraRevenues) currencies.add(normalizeCurrency(revenue.currency));
  for (const commission of commissions) currencies.add(normalizeCurrency(commission.currency));
  currencies.delete(null);

  if (currencies.size > 1) {
    throw new Error(
      `Settlement inputs mix currencies (${[...currencies].sort().join(", ")}); resolve exchange rates before recalculating`
    );
  }

  const totalInvoiceAmount = sumField(activeInvoices, "total_amount");
  const totalPaymentAmount = sumField(
    payments.filter((payment) => payment.status === "confirmed" || payment.status === undefined),
    "amount"
  );
  const totalExpenseAmount = sumField(expenses, "amount");
  const totalExtraRevenueAmount = sumField(extraRevenues, "amount");
  const totalShoppingCommissionAmount = sumField(commissions, "commission_amount");
  const finalProfitAmount =
    totalInvoiceAmount + totalExtraRevenueAmount + totalShoppingCommissionAmount - totalExpenseAmount;

  return {
    currency: currencies.size === 1 ? [...currencies][0] : "KRW",
    total_invoice_amount: roundMoney(totalInvoiceAmount),
    total_payment_amount: roundMoney(totalPaymentAmount),
    total_expense_amount: roundMoney(totalExpenseAmount),
    total_extra_revenue_amount: roundMoney(totalExtraRevenueAmount),
    total_shopping_commission_amount: roundMoney(totalShoppingCommissionAmount),
    final_profit_amount: roundMoney(finalProfitAmount)
  };
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

function normalizeCurrency(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

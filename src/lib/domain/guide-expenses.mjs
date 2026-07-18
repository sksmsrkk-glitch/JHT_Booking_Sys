/**
 * @file 한글 책임: `guide expenses` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
/**
 * 가이드 지출결의서(PMB 인센티브 파일) 기반 실제 비용 정산 로직입니다.
 *
 * 가이드는 투어 종료 후 숙박비, 식음료비, 입장료, 현금 경비, 가이드 비용,
 * 쇼핑 수수료 등을 입력합니다. 이 데이터는 인보이스 매출과 함께 매출분석의
 * 핵심 원가 데이터가 되므로, 화면/API/테스트가 모두 같은 정규화 규칙을 사용합니다.
 */
export const GUIDE_EXPENSE_SECTIONS = [
  "lodging",
  "meal",
  "ticket",
  "cash_expense",
  "guide_fee",
  "shopping",
  "other"
];

export function normalizeGuideExpenseLine(input, index = 0) {
  // PMB 엑셀처럼 수동 합계가 들어온 경우 totalAmount를 우선합니다.
  // 합계가 비어 있으면 단가 x 수량으로 자동 계산합니다.
  const section = GUIDE_EXPENSE_SECTIONS.includes(input?.section) ? input.section : "other";
  const quantity = toNumber(input?.quantity, 1);
  const unitAmount = toNumber(input?.unitAmount, 0);
  const providedTotal = toNumber(input?.totalAmount, NaN);
  const totalAmount = Number.isFinite(providedTotal) ? providedTotal : roundMoney(unitAmount * quantity);

  return {
    id: input?.id ?? null,
    lineNo: Number.isInteger(Number(input?.lineNo)) && Number(input.lineNo) > 0 ? Number(input.lineNo) : index + 1,
    section,
    expenseDate: emptyToNull(input?.expenseDate),
    dayNo: toNullableInteger(input?.dayNo),
    vendorName: emptyToNull(input?.vendorName),
    description: emptyToNull(input?.description) ?? "Actual tour expense",
    unitAmount,
    quantity,
    paxCount: toNullableInteger(input?.paxCount),
    totalAmount,
    paymentMethod: emptyToNull(input?.paymentMethod),
    receiptStoragePath: emptyToNull(input?.receiptStoragePath),
    notes: emptyToNull(input?.notes),
    sourceSheetName: emptyToNull(input?.sourceSheetName),
    sourceSheetRow: toNullableInteger(input?.sourceSheetRow)
  };
}

export function summarizeGuideExpenseReport(lines, cashAdvanceAmount = 0) {
  // 지출결의서 전체 요약은 섹션별 합계 -> 총 실비 -> 선지급금 차감 정산액 순서로 계산합니다.
  // 이 결과가 회계/정산 화면의 actual cost 기준값이 됩니다.
  const normalizedLines = lines.map((line, index) => normalizeGuideExpenseLine(line, index));
  const sectionTotals = Object.fromEntries(GUIDE_EXPENSE_SECTIONS.map((section) => [section, 0]));

  for (const line of normalizedLines) {
    sectionTotals[line.section] += line.totalAmount;
  }

  for (const section of GUIDE_EXPENSE_SECTIONS) {
    sectionTotals[section] = roundMoney(sectionTotals[section]);
  }

  const totalAmount = roundMoney(
    sectionTotals.lodging +
      sectionTotals.meal +
      sectionTotals.ticket +
      sectionTotals.cash_expense +
      sectionTotals.guide_fee +
      sectionTotals.shopping +
      sectionTotals.other
  );
  const settlementAmount = roundMoney(totalAmount - toNumber(cashAdvanceAmount, 0));

  return {
    lines: normalizedLines,
    sectionTotals,
    totalAmount,
    settlementAmount
  };
}

export function buildFinanceExpenseRowsFromGuideReport(report, lines) {
  // 제출(submitted)된 지출결의서는 finance expenses에 동기화합니다.
  // source_guide_expense_report_line_id를 보존해서 같은 라인을 다시 제출해도 중복 비용이 생기지 않게 합니다.
  return lines
    .filter((line) => line.totalAmount > 0)
    .map((line) => ({
      reservation_id: report.reservationId,
      source_guide_expense_report_line_id: line.id,
      expense_date: line.expenseDate,
      category: mapSectionToExpenseCategory(line.section),
      description: [line.vendorName, line.description].filter(Boolean).join(" - "),
      currency: report.currency ?? "KRW",
      amount: line.totalAmount,
      receipt_storage_path: line.receiptStoragePath,
      created_by: report.actorProfileId
    }));
}

function mapSectionToExpenseCategory(section) {
  switch (section) {
    case "lodging":
      return "hotel";
    case "meal":
      return "restaurant";
    case "ticket":
      return "attraction";
    case "guide_fee":
      return "guide";
    case "shopping":
      return "shopping_commission";
    default:
      return "actual_tour_expense";
  }
}

function toNumber(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function emptyToNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * @file 한글 책임: `quotation` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
/**
 * 견적 원가 계산의 단일 기준 함수입니다.
 *
 * 정호여행사의 기존 엑셀 견적서는 호텔, 차량, 식사, 관광지, 가이드 등 항목마다
 * 수량 기준이 다릅니다. 이 함수는 화면/API/테스트가 같은 계산 규칙을 쓰도록
 * 원가 스냅샷, 환율, 수량, 인원, 마진을 한곳에서 계산합니다.
 *
 * 중요한 원칙:
 * - Domestic Supplier 원가는 견적 시점의 snapshot 값으로 보존합니다.
 * - 외화 원가는 exchangeRateToKrw를 곱해 KRW 기준 원가로 환산합니다.
 * - per_person 항목만 인원수(paxCount)를 곱하고, 나머지는 업무 수량(quantity)을 곱합니다.
 * - 마진은 자동 비율, 수동 마진 금액, 수동 판매가 총액을 모두 지원합니다.
 */
export const PRICING_UNITS = [
  "per_person",
  "per_group",
  "per_room",
  "per_vehicle",
  "per_guide",
  "per_day"
];

export function calculateQuoteItem(input) {
  const unitCost = numberOrZero(input.unitCostAmount ?? input.snapshotCostAmount ?? input.snapshotUnitCostAmount);
  const exchangeRateToKrw = numberOrDefault(input.exchangeRateToKrw, 1);
  const quantity = positiveNumber(input.quantity, 1);
  const paxCount = positiveNumber(input.paxCount, 1);
  const pricingUnit = input.pricingUnit ?? "per_group";
  // 엑셀 견적서에서 "1인당" 항목은 인원수와 수량을 모두 곱하지만,
  // 차량/가이드/그룹 비용은 인원수와 무관하게 업무 수량만 곱합니다.
  const costMultiplier = resolveCostMultiplier(pricingUnit, { quantity, paxCount });
  const totalCostOriginal = roundMoney(unitCost * costMultiplier);
  const totalCostKrw = roundMoney(totalCostOriginal * exchangeRateToKrw);

  // 마진 정보는 DB JSON 또는 화면 입력값으로 들어오므로, 계산 전에
  // 세 가지 모드(auto_rate/manual_amount/manual_total) 중 하나로 정규화합니다.
  const margin = resolveMargin(input.margin ?? {});
  const totalSellAmount = roundMoney(applyMargin(totalCostKrw, margin));
  const marginAmount = roundMoney(totalSellAmount - totalCostKrw);

  return {
    sourceSupplierProductId: input.sourceSupplierProductId ?? null,
    sourceSupplierPriceId: input.sourceSupplierPriceId ?? null,
    snapshotItemName: input.snapshotItemName,
    snapshotSupplierName: input.snapshotSupplierName,
    snapshotCostCurrency: input.snapshotCostCurrency ?? "KRW",
    snapshotCostAmount: unitCost,
    exchangeRateToKrw,
    quantity,
    paxCount,
    pricingUnit,
    totalCostOriginal,
    totalCostKrw,
    marginMode: margin.mode,
    marginRate: margin.rate,
    manualMarginAmount: margin.amount,
    totalSellAmount,
    marginAmount,
    grossMarginRate: totalSellAmount === 0 ? 0 : roundRate(marginAmount / totalSellAmount)
  };
}

export function resolveCostMultiplier(pricingUnit, context) {
  if (!PRICING_UNITS.includes(pricingUnit)) {
    throw new Error(`Unsupported pricing unit: ${pricingUnit}`);
  }

  if (pricingUnit === "per_person") {
    return context.paxCount * context.quantity;
  }

  return context.quantity;
}

export function resolveMargin(margin) {
  if (margin.mode === "manual_total") {
    return {
      mode: "manual_total",
      rate: null,
      amount: null,
      manualTotal: numberOrZero(margin.manualTotal)
    };
  }

  if (margin.mode === "manual_amount") {
    return {
      mode: "manual_amount",
      rate: null,
      amount: numberOrZero(margin.amount),
      manualTotal: null
    };
  }

  return {
    mode: "auto_rate",
    rate: numberOrZero(margin.rate),
    amount: null,
    manualTotal: null
  };
}

export function applyMargin(totalCostKrw, margin) {
  // manual_total은 최종 판매가를 사람이 직접 확정한 경우입니다.
  // 이 모드는 원가나 비율이 바뀌어도 판매가가 자동으로 흔들리지 않아야 합니다.
  if (margin.mode === "manual_total") {
    return margin.manualTotal;
  }

  // manual_amount는 원가에 정액 마진을 붙이는 방식입니다.
  // 예: 원가 1,000,000원 + 수동 마진 200,000원 = 판매가 1,200,000원.
  if (margin.mode === "manual_amount") {
    return totalCostKrw + margin.amount;
  }

  // auto_rate는 가장 일반적인 방식입니다.
  // 예: 원가 1,000,000원, rate 0.15 => 판매가 1,150,000원.
  return totalCostKrw * (1 + margin.rate);
}

export function buildQuoteSnapshot(source) {
  // 공급사 원가표는 이후 수정될 수 있으므로, 견적 항목은 반드시
  // "그 시점의 공급사/상품/가격"을 스냅샷으로 복사해서 보관합니다.
  // 이렇게 해야 과거에 발송한 견적서 금액이 DB 원가 변경으로 달라지지 않습니다.
  return {
    sourceSupplierProductId: source.productId,
    sourceSupplierPriceId: source.priceId,
    snapshotItemName: source.productName,
    snapshotSupplierName: source.supplierName,
    snapshotCostCurrency: source.currency,
    snapshotCostAmount: source.unitCostAmount,
    unitCostAmount: source.unitCostAmount,
    exchangeRateToKrw: source.exchangeRateToKrw
  };
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRate(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

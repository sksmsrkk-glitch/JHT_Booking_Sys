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
  const costMultiplier = resolveCostMultiplier(pricingUnit, { quantity, paxCount });
  const totalCostOriginal = roundMoney(unitCost * costMultiplier);
  const totalCostKrw = roundMoney(totalCostOriginal * exchangeRateToKrw);

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
  if (margin.mode === "manual_total") {
    return margin.manualTotal;
  }

  if (margin.mode === "manual_amount") {
    return totalCostKrw + margin.amount;
  }

  return totalCostKrw * (1 + margin.rate);
}

export function buildQuoteSnapshot(source) {
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

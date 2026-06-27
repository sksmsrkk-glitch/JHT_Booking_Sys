import { calculateQuoteItem } from "@/lib/domain/quotation.mjs";
import { requireString } from "@/lib/api/http";

export type QuoteItemInput = Record<string, unknown>;

export function calculateQuoteItemInput(item: QuoteItemInput, fieldPrefix: string) {
  const calculated = calculateQuoteItem({
    sourceSupplierProductId: item.sourceSupplierProductId ?? null,
    sourceSupplierPriceId: item.sourceSupplierPriceId ?? null,
    snapshotItemName: requireString(item.snapshotItemName, `${fieldPrefix}.snapshotItemName`),
    snapshotSupplierName: item.snapshotSupplierName ?? null,
    snapshotCostCurrency: item.snapshotCostCurrency ?? "KRW",
    unitCostAmount: item.snapshotUnitCostAmount ?? item.unitCostAmount ?? 0,
    exchangeRateToKrw: item.exchangeRateToKrw ?? 1,
    quantity: item.quantity ?? 1,
    paxCount: item.paxCount ?? 1,
    pricingUnit: item.pricingUnit ?? "per_group",
    margin: item.margin ?? { mode: "auto_rate", rate: 0 }
  });

  return {
    ...calculated,
    itemCategory: requireString(item.itemCategory, `${fieldPrefix}.itemCategory`),
    partnerVisibleNotes: item.partnerVisibleNotes ?? null,
    internalNotes: item.internalNotes ?? null,
    itineraryDayId: item.itineraryDayId ?? null,
    serviceSection: optionalShortString(item.serviceSection, "land"),
    calculationMode: optionalShortString(item.calculationMode, "auto_formula"),
    excelCellRef: item.excelCellRef ?? null,
    excelFormula: item.excelFormula ?? null,
    manualOverride: Boolean(item.manualOverride),
    supplierCostBreakdown: normalizeObject(item.supplierCostBreakdown),
    publicBreakdown: normalizeObject(item.publicBreakdown)
  };
}

export function toQuoteItemRow(quoteVersionId: string, item: ReturnType<typeof calculateQuoteItemInput>) {
  return {
    quote_version_id: quoteVersionId,
    itinerary_day_id: item.itineraryDayId,
    item_category: item.itemCategory,
    source_supplier_product_id: item.sourceSupplierProductId,
    source_supplier_price_id: item.sourceSupplierPriceId,
    snapshot_item_name: item.snapshotItemName,
    snapshot_supplier_name: item.snapshotSupplierName,
    snapshot_cost_currency: item.snapshotCostCurrency,
    snapshot_unit_cost_amount: item.snapshotCostAmount,
    exchange_rate_to_krw: item.exchangeRateToKrw,
    pricing_unit: item.pricingUnit,
    quantity: item.quantity,
    pax_count: item.paxCount,
    margin_mode: item.marginMode,
    margin_rate: item.marginRate,
    manual_margin_amount: item.manualMarginAmount,
    total_cost_krw: item.totalCostKrw,
    total_sell_amount: item.totalSellAmount,
    partner_visible_notes: item.partnerVisibleNotes,
    internal_notes: item.internalNotes,
    service_section: item.serviceSection,
    calculation_mode: item.calculationMode,
    excel_cell_ref: item.excelCellRef,
    excel_formula: item.excelFormula,
    manual_override: item.manualOverride,
    supplier_cost_breakdown: item.supplierCostBreakdown,
    public_breakdown: item.publicBreakdown
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function optionalShortString(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().slice(0, 80);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

"use client";

import { useState } from "react";
import type { AgencyListItem } from "@/features/agency/types";
import type { CompanyListItem } from "@/features/company/types";

type QuoteItemRow = {
  id: string;
  sourceSupplierProductId: string | null;
  sourceSupplierPriceId: string | null;
  itineraryDayNo: string;
  searchKeyword: string;
  itemCategory: string;
  snapshotItemName: string;
  snapshotSupplierName: string;
  snapshotCostCurrency: string;
  snapshotUnitCostAmount: string;
  exchangeRateToKrw: string;
  calculationPreset: CalculationPreset;
  pricingUnit: string;
  quantity: string;
  paxCount: string;
  marginMode: "auto_rate" | "manual_total";
  marginRate: string;
  manualTotal: string;
  partnerVisibleNotes: string;
};

type ItineraryRow = {
  id: string;
  dayNo: string;
  serviceDate: string;
  title: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  publicDescription: string;
  internalNotes: string;
};

type CalculationPreset =
  | "group_quantity"
  | "person_quantity"
  | "room_night"
  | "vehicle_day"
  | "guide_day"
  | "manual_total";

type CostSearchPrice = {
  id: string;
  pricing_unit: string;
  currency: string;
  cost_amount: number;
  min_pax: number | null;
  max_pax: number | null;
  season_label: string | null;
  status: string;
};

type CostSearchResult = {
  id: string;
  product_type: string;
  name_ko: string;
  name_en: string | null;
  search_name: string;
  domestic_suppliers: {
    id: string;
    category: string;
    name_ko: string;
    name_en: string | null;
    region_level1: string | null;
  };
  supplier_prices: CostSearchPrice[];
};

type SearchState = {
  isLoading: boolean;
  error: string;
  results: CostSearchResult[];
};

const DEFAULT_ITEM_ROW: QuoteItemRow = {
  id: "row-1",
  sourceSupplierProductId: null,
  sourceSupplierPriceId: null,
  itineraryDayNo: "1",
  searchKeyword: "",
  itemCategory: "other",
  snapshotItemName: "Sample service",
  snapshotSupplierName: "Domestic supplier snapshot",
  snapshotCostCurrency: "KRW",
  snapshotUnitCostAmount: "100000",
  exchangeRateToKrw: "1",
  calculationPreset: "group_quantity",
  pricingUnit: "per_group",
  quantity: "1",
  paxCount: "1",
  marginMode: "auto_rate",
  marginRate: "0.15",
  manualTotal: "",
  partnerVisibleNotes: ""
};

const DEFAULT_ITINERARY_ROW: ItineraryRow = {
  id: "day-1",
  dayNo: "1",
  serviceDate: "",
  title: "Arrival and transfer",
  breakfast: "",
  lunch: "",
  dinner: "",
  publicDescription: "Arrival support and transfer service.",
  internalNotes: ""
};

const ITEM_CATEGORIES = ["hotel", "meal", "transport", "attraction", "guide", "other"];

const CALCULATION_PRESETS: Array<{
  value: CalculationPreset;
  label: string;
  pricingUnit: string;
  quantityLabel: string;
  formulaLabel: string;
}> = [
  {
    value: "group_quantity",
    label: "Unit x Qty",
    pricingUnit: "per_group",
    quantityLabel: "Qty",
    formulaLabel: "unit cost x quantity"
  },
  {
    value: "person_quantity",
    label: "Pax x Qty",
    pricingUnit: "per_person",
    quantityLabel: "Times",
    formulaLabel: "unit cost x pax x quantity"
  },
  {
    value: "room_night",
    label: "Room/Night",
    pricingUnit: "per_room",
    quantityLabel: "Room nights",
    formulaLabel: "unit cost x room nights"
  },
  {
    value: "vehicle_day",
    label: "Vehicle/Day",
    pricingUnit: "per_vehicle",
    quantityLabel: "Vehicle days",
    formulaLabel: "unit cost x vehicle days"
  },
  {
    value: "guide_day",
    label: "Guide/Day",
    pricingUnit: "per_guide",
    quantityLabel: "Guide days",
    formulaLabel: "unit cost x guide days"
  },
  {
    value: "manual_total",
    label: "Manual Total",
    pricingUnit: "per_group",
    quantityLabel: "Qty",
    formulaLabel: "manual sell total"
  }
];

export function QuoteCaseCreateForm({
  agencies,
  companies
}: {
  agencies: AgencyListItem[];
  companies: CompanyListItem[];
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [itemRows, setItemRows] = useState<QuoteItemRow[]>([DEFAULT_ITEM_ROW]);
  const [itineraryRows, setItineraryRows] = useState<ItineraryRow[]>([DEFAULT_ITINERARY_ROW]);
  const [searches, setSearches] = useState<Record<string, SearchState>>({});

  async function createQuoteCase(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const normalizedItems = itemRows
      .filter((row) => row.snapshotItemName.trim())
      .map((row) => {
        const preset = getCalculationPreset(row.calculationPreset);
        return {
          sourceSupplierProductId: row.sourceSupplierProductId,
          sourceSupplierPriceId: row.sourceSupplierPriceId,
          itineraryDayNo: normalizeOptionalNumber(row.itineraryDayNo),
          itemCategory: row.itemCategory,
          snapshotItemName: row.snapshotItemName.trim(),
          snapshotSupplierName: normalizeOptionalString(row.snapshotSupplierName),
          snapshotCostCurrency: row.snapshotCostCurrency.trim() || "KRW",
          snapshotUnitCostAmount: normalizeOptionalNumber(row.snapshotUnitCostAmount) ?? 0,
          exchangeRateToKrw: normalizeOptionalNumber(row.exchangeRateToKrw) ?? 1,
          pricingUnit: row.pricingUnit,
          quantity: normalizeOptionalNumber(row.quantity) ?? 1,
          paxCount: normalizeOptionalNumber(row.paxCount) ?? 1,
          margin:
            row.marginMode === "manual_total"
              ? { mode: "manual_total", manualTotal: normalizeOptionalNumber(row.manualTotal) ?? 0 }
              : { mode: "auto_rate", rate: normalizeOptionalNumber(row.marginRate) ?? 0 },
          manualOverride: row.marginMode === "manual_total",
          partnerVisibleNotes: normalizeOptionalString(row.partnerVisibleNotes),
          calculationMode: row.marginMode === "manual_total" ? "manual_total" : "auto_formula",
          excelFormula: preset.formulaLabel,
          publicBreakdown: {
            calculationPreset: row.calculationPreset,
            formula: preset.formulaLabel,
            quantityLabel: preset.quantityLabel,
            itineraryDayNo: normalizeOptionalNumber(row.itineraryDayNo)
          }
        };
      });

    if (normalizedItems.length === 0) {
      setMessage("Add at least one quote item.");
      setIsBusy(false);
      return;
    }

    const itineraryDays = itineraryRows
      .filter((row) => row.title.trim() || row.publicDescription.trim())
      .map((row) => ({
        dayNo: normalizeOptionalNumber(row.dayNo) ?? 1,
        serviceDate: normalizeOptionalString(row.serviceDate),
        title: normalizeOptionalString(row.title),
        mealSummary: {
          breakfast: normalizeOptionalString(row.breakfast),
          lunch: normalizeOptionalString(row.lunch),
          dinner: normalizeOptionalString(row.dinner)
        },
        publicDescription: normalizeOptionalString(row.publicDescription),
        internalNotes: normalizeOptionalString(row.internalNotes)
      }));

    const payload = {
      companyId: String(formData.get("companyId") ?? "").trim(),
      agencyAccountId: String(formData.get("agencyAccountId") ?? "").trim(),
      tourName: String(formData.get("tourName") ?? "").trim(),
      tourType: normalizeOptionalString(formData.get("tourType")),
      currency: String(formData.get("currency") ?? "KRW").trim() || "KRW",
      estimatedPax: normalizeOptionalNumber(formData.get("estimatedPax")),
      startDate: normalizeOptionalString(formData.get("startDate")),
      endDate: normalizeOptionalString(formData.get("endDate")),
      marginMode: "auto_rate",
      defaultMarginRate: normalizeOptionalNumber(formData.get("defaultMarginRate")) ?? 0,
      exchangeRateToKrw: normalizeOptionalNumber(formData.get("exchangeRateToKrw")) ?? 1,
      agencyVisibleSummary: {
        headline: String(formData.get("tourName") ?? "").trim(),
        notes: normalizeOptionalString(formData.get("agencySummaryNotes"))
      },
      termsAndConditions: normalizeOptionalString(formData.get("termsAndConditions")),
      items: normalizedItems,
      itineraryDays
    };

    const response = await fetch("/api/quote-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Quote case creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={createQuoteCase} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Company
          <select name="companyId" required>
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.code} - {company.nameKo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Overseas Agency
          <select name="agencyAccountId" required>
            <option value="">Select agency</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tour Name
          <input name="tourName" placeholder="Seoul incentive tour" required />
        </label>
        <label>
          Currency
          <input defaultValue="KRW" name="currency" />
        </label>
        <label>
          Estimated Pax
          <input min="1" name="estimatedPax" placeholder="20" type="number" />
        </label>
        <label>
          Default Margin Rate
          <input defaultValue="0.15" min="0" name="defaultMarginRate" step="0.01" type="number" />
        </label>
        <label>
          Start Date
          <input name="startDate" type="date" />
        </label>
        <label>
          End Date
          <input name="endDate" type="date" />
        </label>
        <label>
          Exchange Rate to KRW
          <input defaultValue="1" min="0" name="exchangeRateToKrw" step="0.000001" type="number" />
        </label>
      </div>

      <label className="full-width-field">
        Agency Summary Notes
        <textarea name="agencySummaryNotes" placeholder="Customer-visible short summary" rows={3} />
      </label>
      <label className="full-width-field">
        Terms and Conditions
        <textarea name="termsAndConditions" placeholder="Payment terms, cancellation policy, validity" rows={3} />
      </label>

      <section className="full-width-field">
        <div className="section-heading">
          <div>
            <h2>Quote Items</h2>
            <p>Search supplier items by keyword, then apply an Excel-style calculation preset.</p>
          </div>
          <button className="button-secondary" onClick={addItemRow} type="button">
            Add Row
          </button>
        </div>
        <div className="quote-item-table-shell">
          <table className="quote-item-table enhanced">
            <colgroup>
              <col style={{ width: "92px" }} />
              <col style={{ width: "210px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "112px" }} />
              <col style={{ width: "72px" }} />
              <col style={{ width: "72px" }} />
              <col style={{ width: "112px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "104px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Day</th>
                <th>Keyword / Item</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Unit Cost</th>
                <th>Formula</th>
                <th>Qty</th>
                <th>Pax</th>
                <th>Margin</th>
                <th>Sell</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.map((row) => {
                const totals = calculateRowTotals(row);
                const preset = getCalculationPreset(row.calculationPreset);
                const searchState = searches[row.id] ?? { isLoading: false, error: "", results: [] };
                return (
                  <tr key={row.id}>
                    <td>
                      <select
                        aria-label="Itinerary day"
                        value={row.itineraryDayNo}
                        onChange={(event) => updateItemRow(row.id, { itineraryDayNo: event.target.value })}
                      >
                        {itineraryRows.map((day) => (
                          <option key={day.id} value={day.dayNo}>
                            Day {day.dayNo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="item-lookup-cell">
                        <div className="lookup-row">
                          <input
                            aria-label="Search item keyword"
                            placeholder="hotel, bibimbap, bus..."
                            value={row.searchKeyword}
                            onChange={(event) => updateItemRow(row.id, { searchKeyword: event.target.value })}
                          />
                          <button className="button-secondary" onClick={() => searchCostItems(row)} type="button">
                            {searchState.isLoading ? "..." : "Search"}
                          </button>
                        </div>
                        <input
                          aria-label="Item name"
                          placeholder="Item name"
                          required
                          value={row.snapshotItemName}
                          onChange={(event) => updateItemRow(row.id, { snapshotItemName: event.target.value })}
                        />
                        {searchState.error ? <span className="danger-text">{searchState.error}</span> : null}
                        {searchState.results.length > 0 ? (
                          <div className="lookup-results">
                            {searchState.results.slice(0, 3).map((result) => (
                              <button
                                key={result.id}
                                onClick={() => applyCostItem(row.id, result)}
                                type="button"
                              >
                                <strong>{result.name_en ?? result.name_ko}</strong>
                                <span>{result.domestic_suppliers.name_en ?? result.domestic_suppliers.name_ko}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label="Item category"
                        value={row.itemCategory}
                        onChange={(event) => updateItemRow(row.id, { itemCategory: event.target.value })}
                      >
                        {ITEM_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label="Supplier name"
                        placeholder="Supplier"
                        value={row.snapshotSupplierName}
                        onChange={(event) => updateItemRow(row.id, { snapshotSupplierName: event.target.value })}
                      />
                    </td>
                    <td>
                      <div className="money-cell">
                        <input
                          aria-label="Currency"
                          placeholder="KRW"
                          value={row.snapshotCostCurrency}
                          onChange={(event) => updateItemRow(row.id, { snapshotCostCurrency: event.target.value })}
                        />
                        <input
                          aria-label="Unit cost"
                          min="0"
                          placeholder="Cost"
                          step="0.01"
                          type="number"
                          value={row.snapshotUnitCostAmount}
                          onChange={(event) => updateItemRow(row.id, { snapshotUnitCostAmount: event.target.value })}
                        />
                        <input
                          aria-label="Exchange rate to KRW"
                          min="0"
                          placeholder="FX"
                          step="0.000001"
                          type="number"
                          value={row.exchangeRateToKrw}
                          onChange={(event) => updateItemRow(row.id, { exchangeRateToKrw: event.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label="Calculation preset"
                        value={row.calculationPreset}
                        onChange={(event) =>
                          applyCalculationPreset(row.id, event.target.value as CalculationPreset)
                        }
                      >
                        {CALCULATION_PRESETS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="subtext">{preset.formulaLabel}</span>
                    </td>
                    <td>
                      <input
                        aria-label={preset.quantityLabel}
                        min="1"
                        step="0.01"
                        type="number"
                        value={row.quantity}
                        onChange={(event) => updateItemRow(row.id, { quantity: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="Pax count"
                        min="1"
                        step="1"
                        type="number"
                        value={row.paxCount}
                        onChange={(event) => updateItemRow(row.id, { paxCount: event.target.value })}
                      />
                    </td>
                    <td>
                      <div className="margin-cell">
                        <select
                          aria-label="Margin mode"
                          value={row.marginMode}
                          onChange={(event) =>
                            updateItemRow(row.id, { marginMode: event.target.value as QuoteItemRow["marginMode"] })
                          }
                        >
                          <option value="auto_rate">Auto %</option>
                          <option value="manual_total">Manual Total</option>
                        </select>
                        {row.marginMode === "manual_total" ? (
                          <input
                            aria-label="Manual sell total"
                            min="0"
                            placeholder="Total"
                            step="0.01"
                            type="number"
                            value={row.manualTotal}
                            onChange={(event) => updateItemRow(row.id, { manualTotal: event.target.value })}
                          />
                        ) : (
                          <input
                            aria-label="Margin rate"
                            min="-1"
                            placeholder="Rate"
                            step="0.01"
                            type="number"
                            value={row.marginRate}
                            onChange={(event) => updateItemRow(row.id, { marginRate: event.target.value })}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>{formatMoney(totals.sell)}</strong>
                      <span className="subtext">Cost {formatMoney(totals.cost)}</span>
                    </td>
                    <td>
                      <button
                        className="button-secondary"
                        disabled={itemRows.length === 1}
                        onClick={() => removeItemRow(row.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9}>Estimated total</td>
                <td>{formatMoney(itemRows.reduce((sum, row) => sum + calculateRowTotals(row).sell, 0))}</td>
                <td>Editable</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="full-width-field">
        <div className="section-heading">
          <div>
            <h2>Itinerary Days</h2>
            <p>Build public day descriptions without editing JSON.</p>
          </div>
          <button className="button-secondary" onClick={addItineraryRow} type="button">
            Add Day
          </button>
        </div>
        <div className="itinerary-row-list">
          {itineraryRows.map((row) => (
            <article className="itinerary-editor-card" key={row.id}>
              <div className="form-grid three-column">
                <label>
                  Day
                  <input
                    min="1"
                    type="number"
                    value={row.dayNo}
                    onChange={(event) => updateItineraryRow(row.id, { dayNo: event.target.value })}
                  />
                </label>
                <label>
                  Service Date
                  <input
                    type="date"
                    value={row.serviceDate}
                    onChange={(event) => updateItineraryRow(row.id, { serviceDate: event.target.value })}
                  />
                </label>
                <label>
                  Title
                  <input
                    placeholder="Arrival and transfer"
                    value={row.title}
                    onChange={(event) => updateItineraryRow(row.id, { title: event.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid three-column">
                <label>
                  Breakfast
                  <input
                    placeholder="Hotel"
                    value={row.breakfast}
                    onChange={(event) => updateItineraryRow(row.id, { breakfast: event.target.value })}
                  />
                </label>
                <label>
                  Lunch
                  <input
                    placeholder="Local restaurant"
                    value={row.lunch}
                    onChange={(event) => updateItineraryRow(row.id, { lunch: event.target.value })}
                  />
                </label>
                <label>
                  Dinner
                  <input
                    placeholder="Korean BBQ"
                    value={row.dinner}
                    onChange={(event) => updateItineraryRow(row.id, { dinner: event.target.value })}
                  />
                </label>
              </div>
              <label className="full-width-field">
                Public Description
                <textarea
                  rows={3}
                  value={row.publicDescription}
                  onChange={(event) => updateItineraryRow(row.id, { publicDescription: event.target.value })}
                />
              </label>
              <label className="full-width-field">
                Internal Notes
                <textarea
                  rows={2}
                  value={row.internalNotes}
                  onChange={(event) => updateItineraryRow(row.id, { internalNotes: event.target.value })}
                />
              </label>
              <div className="inline-actions">
                <button
                  className="button-secondary"
                  disabled={itineraryRows.length === 1}
                  onClick={() => removeItineraryRow(row.id)}
                  type="button"
                >
                  Remove Day
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Create Quote Case
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );

  async function searchCostItems(row: QuoteItemRow) {
    const query = row.searchKeyword.trim() || row.snapshotItemName.trim();
    if (!query) {
      setSearches((current) => ({
        ...current,
        [row.id]: { isLoading: false, error: "Enter a keyword first.", results: [] }
      }));
      return;
    }

    setSearches((current) => ({ ...current, [row.id]: { isLoading: true, error: "", results: [] } }));
    const response = await fetch(`/api/cost-items/search?q=${encodeURIComponent(query)}&limit=5`);
    const payload = await response.json();
    if (!response.ok) {
      setSearches((current) => ({
        ...current,
        [row.id]: { isLoading: false, error: payload.error ?? "Search failed.", results: [] }
      }));
      return;
    }

    setSearches((current) => ({
      ...current,
      [row.id]: { isLoading: false, error: "", results: Array.isArray(payload.data) ? payload.data : [] }
    }));
  }

  function applyCostItem(rowId: string, result: CostSearchResult) {
    const price = choosePrice(result.supplier_prices);
    const category = mapProductCategory(result.product_type, result.domestic_suppliers.category);
    setItemRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              sourceSupplierProductId: result.id,
              sourceSupplierPriceId: price?.id ?? null,
              itemCategory: category,
              snapshotItemName: result.name_en ?? result.name_ko,
              snapshotSupplierName: result.domestic_suppliers.name_en ?? result.domestic_suppliers.name_ko,
              snapshotCostCurrency: price?.currency ?? row.snapshotCostCurrency,
              snapshotUnitCostAmount:
                price?.cost_amount === undefined || price?.cost_amount === null
                  ? row.snapshotUnitCostAmount
                  : String(price.cost_amount),
              pricingUnit: price?.pricing_unit ?? row.pricingUnit,
              calculationPreset: presetFromPricingUnit(price?.pricing_unit ?? row.pricingUnit),
              searchKeyword: result.search_name
            }
          : row
      )
    );
    setSearches((current) => ({ ...current, [rowId]: { isLoading: false, error: "", results: [] } }));
  }

  function addItemRow() {
    setItemRows((current) => [
      ...current,
      {
        ...DEFAULT_ITEM_ROW,
        id: `row-${Date.now()}-${current.length}`,
        sourceSupplierProductId: null,
        sourceSupplierPriceId: null,
        itineraryDayNo: current[0]?.itineraryDayNo ?? "1",
        searchKeyword: "",
        snapshotItemName: "",
        snapshotSupplierName: "",
        partnerVisibleNotes: ""
      }
    ]);
  }

  function removeItemRow(id: string) {
    setItemRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateItemRow(id: string, patch: Partial<QuoteItemRow>) {
    setItemRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function applyCalculationPreset(id: string, value: CalculationPreset) {
    const preset = getCalculationPreset(value);
    updateItemRow(id, {
      calculationPreset: value,
      pricingUnit: preset.pricingUnit,
      marginMode: value === "manual_total" ? "manual_total" : "auto_rate"
    });
  }

  function addItineraryRow() {
    setItineraryRows((current) => [
      ...current,
      {
        ...DEFAULT_ITINERARY_ROW,
        id: `day-${Date.now()}-${current.length}`,
        dayNo: String(current.length + 1),
        serviceDate: "",
        title: "",
        publicDescription: "",
        internalNotes: ""
      }
    ]);
  }

  function removeItineraryRow(id: string) {
    setItineraryRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateItineraryRow(id: string, patch: Partial<ItineraryRow>) {
    setItineraryRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }
}

function choosePrice(prices: CostSearchPrice[]) {
  return prices.find((price) => price.status === "active") ?? prices[0] ?? null;
}

function mapProductCategory(productType: string, supplierCategory: string) {
  const normalized = `${productType} ${supplierCategory}`.toLowerCase();
  if (normalized.includes("hotel")) return "hotel";
  if (normalized.includes("meal") || normalized.includes("restaurant")) return "meal";
  if (normalized.includes("transport") || normalized.includes("coach") || normalized.includes("vehicle")) {
    return "transport";
  }
  if (normalized.includes("guide")) return "guide";
  if (normalized.includes("attraction") || normalized.includes("ticket")) return "attraction";
  return "other";
}

function presetFromPricingUnit(pricingUnit: string): CalculationPreset {
  if (pricingUnit === "per_person") return "person_quantity";
  if (pricingUnit === "per_room") return "room_night";
  if (pricingUnit === "per_vehicle") return "vehicle_day";
  if (pricingUnit === "per_guide" || pricingUnit === "per_day") return "guide_day";
  return "group_quantity";
}

function getCalculationPreset(value: CalculationPreset) {
  return CALCULATION_PRESETS.find((preset) => preset.value === value) ?? CALCULATION_PRESETS[0];
}

function normalizeOptionalString(value: FormDataEntryValue | string | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: FormDataEntryValue | string | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateRowTotals(row: QuoteItemRow) {
  const unitCost = normalizeOptionalNumber(row.snapshotUnitCostAmount) ?? 0;
  const exchangeRate = normalizeOptionalNumber(row.exchangeRateToKrw) ?? 1;
  const quantity = normalizeOptionalNumber(row.quantity) ?? 1;
  const paxCount = normalizeOptionalNumber(row.paxCount) ?? 1;
  const multiplier = row.pricingUnit === "per_person" ? quantity * paxCount : quantity;
  const cost = roundMoney(unitCost * multiplier * exchangeRate);
  const sell =
    row.marginMode === "manual_total"
      ? roundMoney(normalizeOptionalNumber(row.manualTotal) ?? 0)
      : roundMoney(cost * (1 + (normalizeOptionalNumber(row.marginRate) ?? 0)));

  return { cost, sell };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

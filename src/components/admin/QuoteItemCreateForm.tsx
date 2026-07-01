"use client";

import { useState } from "react";
import type { CostSearchItem, CostSearchPrice } from "@/features/costing/types";
import type { QuoteItineraryDayDetail } from "@/features/quotation/types";

const PRICING_UNITS = ["per_person", "per_group", "per_room", "per_vehicle", "per_guide", "per_day"];
const ITEM_CATEGORIES = ["room", "vehicle", "meal", "ticket", "guide_service", "meeting_room", "shopping_commission", "other"];
const MARGIN_MODES = ["auto_rate", "manual_amount", "manual_total"];
const SERVICE_SECTIONS = ["hotel", "vehicle", "guide", "meal", "admission", "shopping", "land", "optional", "other"];
const CALCULATION_MODES = ["auto_formula", "manual_unit", "manual_total", "override"];

export function QuoteItemCreateForm({
  costItems = [],
  itineraryDays = [],
  quoteCaseId,
  quoteVersionId,
  disabledReason
}: {
  costItems?: CostSearchItem[];
  itineraryDays?: QuoteItineraryDayDetail[];
  quoteCaseId: string;
  quoteVersionId: string | null;
  disabledReason?: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [itemCategory, setItemCategory] = useState("room");
  const [snapshotItemName, setSnapshotItemName] = useState("");
  const [snapshotSupplierName, setSnapshotSupplierName] = useState("");
  const [snapshotCostCurrency, setSnapshotCostCurrency] = useState("KRW");
  const [snapshotUnitCostAmount, setSnapshotUnitCostAmount] = useState("0");
  const [exchangeRateCountryCode, setExchangeRateCountryCode] = useState("");
  const [exchangeRateToKrw, setExchangeRateToKrw] = useState("1");
  const [exchangeRateNotice, setExchangeRateNotice] = useState("");
  const [pricingUnit, setPricingUnit] = useState("per_group");
  const [paxCount, setPaxCount] = useState("1");
  const activeCostOptions = costItems.flatMap((item) =>
    (item.supplier_prices ?? [])
      .filter((price) => price.status === "active")
      .map((price) => ({ item, price }))
  );

  async function submit(formData: FormData) {
    if (!quoteVersionId) return;
    setIsBusy(true);
    setMessage("");

    const marginMode = String(formData.get("marginMode") ?? "auto_rate");
    const payload = {
      quoteVersionId,
      itemCategory: String(formData.get("itemCategory") ?? "").trim(),
      snapshotItemName: String(formData.get("snapshotItemName") ?? "").trim(),
      snapshotSupplierName: normalizeOptionalString(formData.get("snapshotSupplierName")),
      snapshotCostCurrency: String(formData.get("snapshotCostCurrency") ?? "KRW").trim() || "KRW",
      snapshotUnitCostAmount: normalizeNumber(formData.get("snapshotUnitCostAmount"), 0),
      exchangeRateToKrw: normalizeNumber(formData.get("exchangeRateToKrw"), 1),
      pricingUnit: String(formData.get("pricingUnit") ?? "per_group"),
      quantity: normalizeNumber(formData.get("quantity"), 1),
      paxCount: normalizeNumber(formData.get("paxCount"), 1),
      margin: buildMargin(marginMode, formData),
      partnerVisibleNotes: normalizeOptionalString(formData.get("partnerVisibleNotes")),
      internalNotes: normalizeOptionalString(formData.get("internalNotes")),
      itineraryDayId: normalizeOptionalString(formData.get("itineraryDayId")),
      serviceSection: String(formData.get("serviceSection") ?? "land"),
      calculationMode: String(formData.get("calculationMode") ?? "auto_formula"),
      excelCellRef: normalizeOptionalString(formData.get("excelCellRef")),
      excelFormula: normalizeOptionalString(formData.get("excelFormula")),
      manualOverride: formData.get("manualOverride") === "on",
      supplierCostBreakdown: parseJsonObject(formData.get("supplierCostBreakdown")),
      publicBreakdown: parseJsonObject(formData.get("publicBreakdown"))
    };

    const response = await fetch(`/api/quote-cases/${quoteCaseId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Quote item creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  function applyCostOption(value: string) {
    if (!value) return;
    const [productId, priceId] = value.split(":");
    const option = activeCostOptions.find(({ item, price }) => item.id === productId && price.id === priceId);
    if (!option) return;

    const category = ITEM_CATEGORIES.includes(option.item.product_type) ? option.item.product_type : "other";
    setItemCategory(category);
    setSnapshotItemName(formatSnapshotItemName(option.item, option.price));
    setSnapshotSupplierName(option.item.domestic_suppliers.name_ko);
    setSnapshotCostCurrency(option.price.currency);
    setSnapshotUnitCostAmount(String(Number(option.price.cost_amount ?? 0)));
    setPricingUnit(option.price.pricing_unit);
    setPaxCount(String(option.price.min_pax ?? option.price.max_pax ?? 1));
    void applyCommonExchangeRate(option.price.currency, exchangeRateCountryCode);
  }

  async function applyCommonExchangeRate(currency = snapshotCostCurrency, countryCode = exchangeRateCountryCode) {
    const normalized = currency.trim().toUpperCase() || "KRW";
    const normalizedCountry = countryCode.trim().toUpperCase();
    try {
      const params = new URLSearchParams({ latest: "true", baseCurrency: normalized });
      if (normalizedCountry) params.set("countryCode", normalizedCountry);
      const response = await fetch(`/api/exchange-rates?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload.data) {
        setExchangeRateNotice(`No active common FX rate found for ${normalized}${normalizedCountry ? ` / ${normalizedCountry}` : ""}.`);
        return;
      }
      setExchangeRateToKrw(String(payload.data.rate));
      setExchangeRateNotice(
        `${payload.data.countryCode ? `${payload.data.countryCode} ` : ""}${payload.data.baseCurrency}/${payload.data.quoteCurrency} ${Number(payload.data.rate).toLocaleString()} applied from common FX.`
      );
    } catch {
      setExchangeRateNotice("Common FX lookup failed. Enter manually.");
    }
  }

  return (
    <form action={submit} className="stacked-form">
      {disabledReason ? <p className="warning-text">{disabledReason}</p> : null}
      {activeCostOptions.length > 0 ? (
        <label className="full-width-field">
          Cost Snapshot Source
          <select disabled={!quoteVersionId || isBusy} onChange={(event) => applyCostOption(event.target.value)}>
            <option value="">Manual entry</option>
            {activeCostOptions.map(({ item, price }) => (
              <option key={`${item.id}:${price.id}`} value={`${item.id}:${price.id}`}>
                {item.domestic_suppliers.name_ko} - {item.name_ko} / {price.currency}{" "}
                {Number(price.cost_amount).toLocaleString()} / {formatLabel(price.pricing_unit)}
                {price.season_label ? ` / ${price.season_label}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="form-grid three-column">
        <label>
          Service Section
          <select disabled={!quoteVersionId || isBusy} name="serviceSection">
            {SERVICE_SECTIONS.map((section) => (
              <option key={section} value={section}>
                {formatLabel(section)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Itinerary Day
          <select disabled={!quoteVersionId || isBusy} name="itineraryDayId">
            <option value="">Unassigned</option>
            {itineraryDays.map((day) => (
              <option key={day.id} value={day.id}>
                Day {day.dayNo}
                {day.title ? ` - ${day.title}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            disabled={!quoteVersionId || isBusy}
            name="itemCategory"
            onChange={(event) => setItemCategory(event.target.value)}
            required
            value={itemCategory}
          >
            {ITEM_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Item Name
          <input
            disabled={!quoteVersionId || isBusy}
            name="snapshotItemName"
            onChange={(event) => setSnapshotItemName(event.target.value)}
            placeholder="Hotel, guide, vehicle"
            required
            value={snapshotItemName}
          />
        </label>
        <label>
          Supplier Snapshot
          <input
            disabled={!quoteVersionId || isBusy}
            name="snapshotSupplierName"
            onChange={(event) => setSnapshotSupplierName(event.target.value)}
            placeholder="Supplier name at quote time"
            value={snapshotSupplierName}
          />
        </label>
        <label>
          Cost Currency
          <input
            disabled={!quoteVersionId || isBusy}
            name="snapshotCostCurrency"
            onChange={(event) => setSnapshotCostCurrency(event.target.value.toUpperCase())}
            value={snapshotCostCurrency}
          />
        </label>
        <label>
          Unit Cost
          <input
            disabled={!quoteVersionId || isBusy}
            min="0"
            name="snapshotUnitCostAmount"
            onChange={(event) => setSnapshotUnitCostAmount(event.target.value)}
            required
            step="0.01"
            type="number"
            value={snapshotUnitCostAmount}
          />
        </label>
        <label>
          FX Country Code
          <input
            disabled={!quoteVersionId || isBusy}
            onChange={(event) => setExchangeRateCountryCode(event.target.value.toUpperCase())}
            placeholder="TH, MY, SG"
            value={exchangeRateCountryCode}
          />
        </label>
        <label>
          FX to KRW
          <input
            disabled={!quoteVersionId || isBusy}
            min="0"
            name="exchangeRateToKrw"
            onChange={(event) => setExchangeRateToKrw(event.target.value)}
            required
            step="0.000001"
            type="number"
            value={exchangeRateToKrw}
          />
          <button className="button-secondary mini-button" disabled={!quoteVersionId || isBusy} onClick={() => applyCommonExchangeRate()} type="button">
            Apply Common FX
          </button>
        </label>
        <label>
          Pricing Unit
          <select
            disabled={!quoteVersionId || isBusy}
            name="pricingUnit"
            onChange={(event) => setPricingUnit(event.target.value)}
            value={pricingUnit}
          >
            {PRICING_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {formatLabel(unit)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input defaultValue="1" disabled={!quoteVersionId || isBusy} min="0.01" name="quantity" step="0.01" type="number" />
        </label>
        <label>
          Pax Count
          <input
            disabled={!quoteVersionId || isBusy}
            min="1"
            name="paxCount"
            onChange={(event) => setPaxCount(event.target.value)}
            step="1"
            type="number"
            value={paxCount}
          />
        </label>
        <label>
          Margin Mode
          <select defaultValue="auto_rate" disabled={!quoteVersionId || isBusy} name="marginMode">
            {MARGIN_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {formatLabel(mode)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Margin Rate
          <input defaultValue="0.15" disabled={!quoteVersionId || isBusy} min="0" name="marginRate" step="0.01" type="number" />
        </label>
        <label>
          Manual Margin / Total
          <input defaultValue="0" disabled={!quoteVersionId || isBusy} min="0" name="manualAmount" step="0.01" type="number" />
        </label>
        <label>
          Calculation Mode
          <select defaultValue="auto_formula" disabled={!quoteVersionId || isBusy} name="calculationMode">
            {CALCULATION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {formatLabel(mode)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Excel Cell Ref.
          <input disabled={!quoteVersionId || isBusy} name="excelCellRef" placeholder="B24 or Quotation!H42" />
        </label>
        <label className="checkbox-label">
          <input disabled={!quoteVersionId || isBusy} name="manualOverride" type="checkbox" />
          Manual override
        </label>
      </div>
      <label className="full-width-field">
        Excel Formula / Calculation Note
        <textarea
          disabled={!quoteVersionId || isBusy}
          name="excelFormula"
          placeholder="Example: unit cost x nights x rooms, or copied Excel formula reference"
          rows={2}
        />
      </label>
      <label className="full-width-field">
        Supplier Cost Breakdown JSON
        <textarea
          disabled={!quoteVersionId || isBusy}
          name="supplierCostBreakdown"
          placeholder='{"rooms":10,"nights":4,"foc":1,"singleSupplement":0}'
          rows={2}
        />
      </label>
      <label className="full-width-field">
        Public Breakdown JSON
        <textarea
          disabled={!quoteVersionId || isBusy}
          name="publicBreakdown"
          placeholder='{"label":"Hotel 4 nights","included":true}'
          rows={2}
        />
      </label>
      <label className="full-width-field">
        Partner-visible Notes
        <textarea disabled={!quoteVersionId || isBusy} name="partnerVisibleNotes" rows={2} />
      </label>
      <label className="full-width-field">
        Internal Notes
        <textarea disabled={!quoteVersionId || isBusy} name="internalNotes" rows={2} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={!quoteVersionId || isBusy} type="submit">
          Add Quote Item
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
        {exchangeRateNotice ? <span className="subtext">{exchangeRateNotice}</span> : null}
      </div>
    </form>
  );
}

function buildMargin(mode: string, formData: FormData) {
  if (mode === "manual_total") {
    return { mode, manualTotal: normalizeNumber(formData.get("manualAmount"), 0) };
  }

  if (mode === "manual_amount") {
    return { mode, amount: normalizeNumber(formData.get("manualAmount"), 0) };
  }

  return { mode: "auto_rate", rate: normalizeNumber(formData.get("marginRate"), 0) };
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonObject(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return {};
  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return { raw: normalized };
  }
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSnapshotItemName(item: CostSearchItem, price: CostSearchPrice) {
  return [item.name_ko, price.season_label, item.room_type].filter(Boolean).join(" / ");
}

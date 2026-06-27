"use client";

import { useState } from "react";
import type { AgencyListItem } from "@/features/agency/types";
import type { CompanyListItem } from "@/features/company/types";

const DEFAULT_ITEMS_JSON = `[
  {
    "itemCategory": "other",
    "snapshotItemName": "Sample service",
    "snapshotSupplierName": "Domestic supplier snapshot",
    "snapshotCostCurrency": "KRW",
    "snapshotUnitCostAmount": 100000,
    "exchangeRateToKrw": 1,
    "pricingUnit": "per_group",
    "quantity": 1,
    "paxCount": 1,
    "margin": { "mode": "auto_rate", "rate": 0.15 }
  }
]`;

const DEFAULT_ITINERARY_JSON = `[
  {
    "dayNo": 1,
    "title": "Arrival and transfer",
    "mealSummary": {},
    "publicDescription": "Arrival support and transfer service."
  }
]`;

export function QuoteCaseCreateForm({
  agencies,
  companies
}: {
  agencies: AgencyListItem[];
  companies: CompanyListItem[];
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function createQuoteCase(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const parsedItems = parseJsonArray(String(formData.get("itemsJson") ?? ""), "Quote items JSON");
    if (!parsedItems.ok) {
      setMessage(parsedItems.message);
      setIsBusy(false);
      return;
    }

    const parsedItinerary = parseJsonArray(String(formData.get("itineraryJson") ?? ""), "Itinerary JSON");
    if (!parsedItinerary.ok) {
      setMessage(parsedItinerary.message);
      setIsBusy(false);
      return;
    }

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
      items: parsedItems.value,
      itineraryDays: parsedItinerary.value
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
      <label className="full-width-field">
        Quote Items JSON
        <textarea defaultValue={DEFAULT_ITEMS_JSON} name="itemsJson" required rows={12} />
      </label>
      <label className="full-width-field">
        Itinerary JSON
        <textarea defaultValue={DEFAULT_ITINERARY_JSON} name="itineraryJson" rows={8} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Create Quote Case
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

function parseJsonArray(value: string, label: string): { ok: true; value: unknown[] } | { ok: false; message: string } {
  if (!value.trim()) return { ok: true, value: [] };
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { ok: false, message: `${label} must be an array` };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: `${label} is invalid` };
  }
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

"use client";

import { useState } from "react";
import { PRICING_UNITS, SUPPLIER_PRODUCT_TYPES } from "@/features/supplier/queries";

export function SupplierProductCreateForm({ supplierId }: { supplierId: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const payload = {
      productType: String(formData.get("productType") ?? ""),
      nameKo: String(formData.get("nameKo") ?? "").trim(),
      nameEn: normalizeOptionalString(formData.get("nameEn")),
      searchName: normalizeOptionalString(formData.get("searchName")),
      description: normalizeOptionalString(formData.get("description")),
      capacity: normalizeOptionalNumber(formData.get("capacity")),
      roomType: normalizeOptionalString(formData.get("roomType")),
      breakfastIncluded: normalizeOptionalBoolean(formData.get("breakfastIncluded")),
      vehicleSeatCount: normalizeOptionalNumber(formData.get("vehicleSeatCount")),
      menuTags: normalizeOptionalString(formData.get("menuTags"))
    };

    const response = await fetch(`/api/domestic-suppliers/${supplierId}/products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Product creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Product Type
          <select disabled={isBusy} name="productType" required>
            {SUPPLIER_PRODUCT_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name KO
          <input disabled={isBusy} name="nameKo" placeholder="상품명" required />
        </label>
        <label>
          Search Name
          <input disabled={isBusy} name="searchName" placeholder="Search aliases" />
        </label>
        <label>
          Name EN
          <input disabled={isBusy} name="nameEn" placeholder="English name" />
        </label>
        <label>
          Capacity
          <input disabled={isBusy} min="0" name="capacity" step="1" type="number" />
        </label>
        <label>
          Vehicle Seats
          <input disabled={isBusy} min="1" name="vehicleSeatCount" step="1" type="number" />
        </label>
        <label>
          Room Type
          <input disabled={isBusy} name="roomType" placeholder="Twin, Double, Suite" />
        </label>
        <label>
          Breakfast
          <select defaultValue="" disabled={isBusy} name="breakfastIncluded">
            <option value="">Not set</option>
            <option value="true">Included</option>
            <option value="false">Not included</option>
          </select>
        </label>
        <label>
          Menu Tags
          <input disabled={isBusy} name="menuTags" placeholder="comma-separated" />
        </label>
      </div>
      <label className="full-width-field">
        Description
        <textarea disabled={isBusy} name="description" rows={3} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Add Product
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

export function SupplierPriceCreateForm({ productId }: { productId: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const payload = {
      pricingUnit: String(formData.get("pricingUnit") ?? ""),
      currency: String(formData.get("currency") ?? "KRW").trim() || "KRW",
      costAmount: normalizeOptionalNumber(formData.get("costAmount")) ?? 0,
      staffDiscountAmount: normalizeOptionalNumber(formData.get("staffDiscountAmount")),
      minPax: normalizeOptionalNumber(formData.get("minPax")),
      maxPax: normalizeOptionalNumber(formData.get("maxPax")),
      seasonLabel: normalizeOptionalString(formData.get("seasonLabel")),
      validFrom: normalizeOptionalString(formData.get("validFrom")),
      validTo: normalizeOptionalString(formData.get("validTo")),
      weekdayRule: normalizeOptionalString(formData.get("weekdayRule")),
      includesTax: formData.get("includesTax") !== "false",
      notes: normalizeOptionalString(formData.get("notes"))
    };

    const response = await fetch(`/api/supplier-products/${productId}/prices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Price creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <details className="row-details">
      <summary>Add Price</summary>
      <form action={submit} className="compact-form">
        <div className="form-grid three-column">
          <label>
            Pricing Unit
            <select disabled={isBusy} name="pricingUnit" required>
              {PRICING_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {formatLabel(unit)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Currency
            <input defaultValue="KRW" disabled={isBusy} name="currency" />
          </label>
          <label>
            Cost Amount
            <input disabled={isBusy} min="0" name="costAmount" required step="0.01" type="number" />
          </label>
          <label>
            Staff Discount
            <input disabled={isBusy} min="0" name="staffDiscountAmount" step="0.01" type="number" />
          </label>
          <label>
            Min Pax
            <input disabled={isBusy} min="1" name="minPax" step="1" type="number" />
          </label>
          <label>
            Max Pax
            <input disabled={isBusy} min="1" name="maxPax" step="1" type="number" />
          </label>
          <label>
            Season
            <input disabled={isBusy} name="seasonLabel" placeholder="Peak, Low, 2026 Spring" />
          </label>
          <label>
            Valid From
            <input disabled={isBusy} name="validFrom" type="date" />
          </label>
          <label>
            Valid To
            <input disabled={isBusy} name="validTo" type="date" />
          </label>
          <label>
            Tax
            <select defaultValue="true" disabled={isBusy} name="includesTax">
              <option value="true">Includes tax</option>
              <option value="false">Excludes tax</option>
            </select>
          </label>
          <label>
            Weekday Rule
            <input disabled={isBusy} name="weekdayRule" placeholder="weekday/weekend/all" />
          </label>
        </div>
        <label className="full-width-field">
          Notes
          <textarea disabled={isBusy} name="notes" rows={2} />
        </label>
        <div className="inline-actions">
          <button className="button-secondary" disabled={isBusy} type="submit">
            Save Price
          </button>
          {message ? <span className="danger-text">{message}</span> : null}
        </div>
      </form>
    </details>
  );
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

function normalizeOptionalBoolean(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized === "true";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

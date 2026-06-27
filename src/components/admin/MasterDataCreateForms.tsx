"use client";

import { useState } from "react";
import { SUPPLIER_CATEGORIES } from "@/features/supplier/queries";
import type { CompanyListItem } from "@/features/company/types";

export function DomesticSupplierCreateForm({ companies }: { companies: CompanyListItem[] }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = readForm(formData, [
      "companyId",
      "category",
      "nameKo",
      "nameEn",
      "searchKeywords",
      "regionLevel1",
      "regionLevel2",
      "address",
      "phone",
      "website",
      "internalNotes"
    ]);

    const response = await fetch("/api/domestic-suppliers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Supplier creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <CompanySelect companies={companies} />
        <label>
          Category
          <select name="category" required>
            {SUPPLIER_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name KO
          <input name="nameKo" placeholder="국내 공급사명" required />
        </label>
        <label>
          Name EN
          <input name="nameEn" placeholder="English name" />
        </label>
        <label>
          Region 1
          <input name="regionLevel1" placeholder="Seoul, Busan" />
        </label>
        <label>
          Region 2
          <input name="regionLevel2" placeholder="Jung-gu, Haeundae" />
        </label>
        <label>
          Phone
          <input name="phone" placeholder="+82..." />
        </label>
        <label>
          Website
          <input name="website" placeholder="https://..." />
        </label>
        <label>
          Search Keywords
          <input name="searchKeywords" placeholder="aliases, nearby places" />
        </label>
      </div>
      <label className="full-width-field">
        Address
        <input name="address" placeholder="Supplier address" />
      </label>
      <label className="full-width-field">
        Internal Notes
        <textarea name="internalNotes" placeholder="Internal supplier notes" rows={3} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Add Supplier
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

export function AgencyCreateForm({ companies }: { companies: CompanyListItem[] }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = readForm(formData, [
      "companyId",
      "name",
      "countryCode",
      "emailDomain",
      "phone",
      "website",
      "billingCurrency",
      "googleDriveFolderUrl"
    ]);

    const response = await fetch("/api/agencies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Agency creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <CompanySelect companies={companies} />
        <label>
          Agency Name
          <input name="name" placeholder="Overseas agency name" required />
        </label>
        <label>
          Country Code
          <input maxLength={12} name="countryCode" placeholder="MY, VN, JP" />
        </label>
        <label>
          Email Domain
          <input name="emailDomain" placeholder="agency.com" />
        </label>
        <label>
          Billing Currency
          <input defaultValue="KRW" name="billingCurrency" />
        </label>
        <label>
          Phone
          <input name="phone" placeholder="+60..." />
        </label>
        <label>
          Website
          <input name="website" placeholder="https://..." />
        </label>
        <label>
          Drive Folder URL
          <input name="googleDriveFolderUrl" placeholder="https://drive.google.com/..." />
        </label>
      </div>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Add Agency
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

function CompanySelect({ companies }: { companies: CompanyListItem[] }) {
  return (
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
  );
}

function readForm(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "").trim()]));
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

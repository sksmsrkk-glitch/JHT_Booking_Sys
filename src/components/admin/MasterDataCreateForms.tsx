"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useEffect, useState } from "react";
import { buildCurrencyOptions, DEFAULT_COUNTRY_REFERENCES, mergeCountryReferences } from "@/features/countries/defaults";
import type { CountryReference } from "@/features/countries/types";
import { SUPPLIER_CATEGORIES } from "@/features/supplier/queries";
import type { CompanyListItem } from "@/features/company/types";

const initialCountryOptions = mergeCountryReferences(DEFAULT_COUNTRY_REFERENCES);
const initialCountry = pickDefaultCountry(initialCountryOptions);

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
    requestRouteRefresh();
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
  const [countryOptions, setCountryOptions] = useState<CountryReference[]>(initialCountryOptions);
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialCountry?.countryCode ?? "");
  const [billingCurrency, setBillingCurrency] = useState(initialCountry?.defaultCurrency ?? "KRW");
  const currencyOptions = buildCurrencyOptions(countryOptions, billingCurrency);

  useEffect(() => {
    let mounted = true;
    fetch("/api/countries")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.data?.length) return;
        const merged = mergeCountryReferences(payload.data);
        const nextCountry = merged.find((country) => country.countryCode === selectedCountryCode) ?? pickDefaultCountry(merged);
        setCountryOptions(merged);
        setSelectedCountryCode(nextCountry?.countryCode ?? "");
        setBillingCurrency(nextCountry?.defaultCurrency ?? "KRW");
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  function selectCountry(countryCode: string) {
    const country = countryOptions.find((item) => item.countryCode === countryCode);
    setSelectedCountryCode(country?.countryCode ?? "");
    setBillingCurrency(country?.defaultCurrency ?? "KRW");
  }

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = readForm(formData, [
      "companyId",
      "name",
      "emailDomain",
      "phone",
      "website",
      "googleDriveFolderUrl"
    ]);
    payload.countryCode = selectedCountryCode;
    payload.billingCurrency = billingCurrency;

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
    requestRouteRefresh();
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
          Country
          <select disabled={isBusy} name="countryCode" required value={selectedCountryCode} onChange={(event) => selectCountry(event.target.value)}>
            {countryOptions.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.countryCode} - {country.countryName}
                {country.defaultCurrency ? ` (${country.defaultCurrency})` : ""}
              </option>
            ))}
          </select>
          <span className="subtext">Common country master</span>
        </label>
        <label>
          Email Domain
          <input name="emailDomain" placeholder="agency.com" />
        </label>
        <label>
          Billing Currency
          <select disabled={isBusy} name="billingCurrency" required value={billingCurrency} onChange={(event) => setBillingCurrency(event.target.value)}>
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
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

function pickDefaultCountry(countries: CountryReference[]) {
  // 해외 파트너 기본값은 공통 국가 마스터의 MY/MYR을 우선 사용합니다.
  return countries.find((country) => country.countryCode === "MY") ?? countries[0];
}

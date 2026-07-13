"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCurrencyOptions, DEFAULT_COUNTRY_REFERENCES, mergeCountryReferences } from "@/features/countries/defaults";
import type { CountryReference } from "@/features/countries/types";

const initialCountryOptions = mergeCountryReferences(DEFAULT_COUNTRY_REFERENCES);
const initialCountry = pickDefaultCountry(initialCountryOptions);

export function AgencySignupApplicationForm() {
  const [countryOptions, setCountryOptions] = useState<CountryReference[]>(initialCountryOptions);
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialCountry?.countryCode ?? "");
  const [billingCurrency, setBillingCurrency] = useState(initialCountry?.defaultCurrency ?? "");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const selectedCountry = countryOptions.find((country) => country.countryCode === selectedCountryCode) ?? countryOptions[0];
  const currencyOptions = useMemo(
    () => buildCurrencyOptions(countryOptions, selectedCountry?.defaultCurrency ?? billingCurrency),
    [billingCurrency, countryOptions, selectedCountry?.defaultCurrency]
  );

  useEffect(() => {
    let mounted = true;
    fetch("/api/countries")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.data?.length) return;
        const countries = payload.data as CountryReference[];
        const nextCountry = countries.find((country) => country.countryCode === selectedCountryCode) ?? pickDefaultCountry(countries);
        setCountryOptions(countries);
        setSelectedCountryCode(nextCountry?.countryCode ?? "");
        setBillingCurrency(nextCountry?.defaultCurrency ?? billingCurrency);
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
    const country = countryOptions.find((item) => item.countryCode === selectedCountryCode);
    const payload = {
      companyName: String(formData.get("companyName") ?? "").trim(),
      contactName: String(formData.get("contactName") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      countryCode: selectedCountryCode,
      country: country ? `${country.countryCode} - ${country.countryName}` : selectedCountryCode,
      billingCurrency: billingCurrency || country?.defaultCurrency || "KRW",
      website: String(formData.get("website") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim()
    };

    const response = await fetch("/api/agency/signup-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Application failed");
      return;
    }
    setMessage(`Application submitted. Reference: ${result.data.id}`);
  }

  return (
    <form action={submit} className="panel-section stacked-form">
      <div className="section-heading">
        <div>
          <h2>Partner Sign-up Application</h2>
          <p>Country and billing currency are selected from JHT common country / FX master data, not typed manually.</p>
        </div>
        <span>Approval required</span>
      </div>
      <div className="form-grid two-column">
        <label>
          Partner Company Name
          <input disabled={isBusy} name="companyName" required />
        </label>
        <label>
          Contact Person
          <input disabled={isBusy} name="contactName" />
        </label>
        <label>
          Phone
          <input disabled={isBusy} name="phone" />
        </label>
        <label>
          Email
          <input disabled={isBusy} name="email" required type="email" />
        </label>
        <label>
          Country
          <select disabled={isBusy} name="countryCode" required value={selectedCountryCode} onChange={(event) => selectCountry(event.target.value)}>
            <option value="" disabled>
              Select country
            </option>
            {countryOptions.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.countryCode} - {country.countryName}
                {country.defaultCurrency ? ` (${country.defaultCurrency})` : ""}
              </option>
            ))}
          </select>
          <span className="subtext">Country Code + Country Name are loaded from the common country master.</span>
        </label>
        <label>
          Billing Currency / FX Base
          <select disabled name="billingCurrency" required value={billingCurrency} onChange={(event) => setBillingCurrency(event.target.value)}>
            <option value="" disabled>
              Select currency
            </option>
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
          <span className="subtext">Actual KRW rates are managed by JHT in Exchange Rates.</span>
        </label>
        <label>
          Website
          <input disabled={isBusy} name="website" placeholder="https://..." />
        </label>
      </div>
      <label>
        Notes
        <textarea disabled={isBusy} name="notes" placeholder="Business type, expected Korea groups, contact notes" rows={3} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Submit Application
        </button>
        {message ? <span>{message}</span> : null}
      </div>
    </form>
  );
}

function pickDefaultCountry(countries: CountryReference[]) {
  // 파트너 가입 테스트의 기본 국가/통화도 공통 마스터의 MY/MYR 기준으로 시작합니다.
  return countries.find((country) => country.countryCode === "MY") ?? countries[0];
}

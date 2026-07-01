"use client";

import { useEffect, useState } from "react";

type CountryOption = {
  countryCode: string;
  countryName: string;
  defaultCurrency: string | null;
};

const FALLBACK_COUNTRIES: CountryOption[] = [
  { countryCode: "MY", countryName: "Malaysia", defaultCurrency: "MYR" },
  { countryCode: "TH", countryName: "Thailand", defaultCurrency: "THB" },
  { countryCode: "VN", countryName: "Vietnam", defaultCurrency: "VND" },
  { countryCode: "ID", countryName: "Indonesia", defaultCurrency: "IDR" },
  { countryCode: "PH", countryName: "Philippines", defaultCurrency: "PHP" },
  { countryCode: "SG", countryName: "Singapore", defaultCurrency: "SGD" },
  { countryCode: "JP", countryName: "Japan", defaultCurrency: "JPY" },
  { countryCode: "CN", countryName: "China", defaultCurrency: "CNY" },
  { countryCode: "TW", countryName: "Taiwan", defaultCurrency: "TWD" },
  { countryCode: "HK", countryName: "Hong Kong", defaultCurrency: "HKD" },
  { countryCode: "IN", countryName: "India", defaultCurrency: "INR" },
  { countryCode: "AE", countryName: "United Arab Emirates", defaultCurrency: "AED" },
  { countryCode: "US", countryName: "United States", defaultCurrency: "USD" },
  { countryCode: "AU", countryName: "Australia", defaultCurrency: "AUD" }
];

export function ExchangeRateCreateForm() {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>(FALLBACK_COUNTRIES);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedCountryName, setSelectedCountryName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");

  useEffect(() => {
    let mounted = true;
    fetch("/api/countries")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.data?.length) return;
        setCountryOptions(
          payload.data.map((country: CountryOption) => ({
            countryCode: country.countryCode,
            countryName: country.countryName,
            defaultCurrency: country.defaultCurrency ?? null
          }))
        );
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  function selectCountry(countryCode: string) {
    const country = countryOptions.find((item) => item.countryCode === countryCode);
    setSelectedCountryCode(country?.countryCode ?? "");
    setSelectedCountryName(country?.countryName ?? "");
    if (country?.defaultCurrency) setBaseCurrency(country.defaultCurrency);
  }

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const payload = {
      baseCurrency: String(formData.get("baseCurrency") ?? "").trim().toUpperCase(),
      countryCode: String(formData.get("countryCode") ?? "").trim().toUpperCase(),
      countryName: String(formData.get("countryName") ?? "").trim(),
      quoteCurrency: String(formData.get("quoteCurrency") ?? "KRW").trim().toUpperCase() || "KRW",
      rate: Number(formData.get("rate") ?? 0),
      effectiveDate: String(formData.get("effectiveDate") ?? "").trim(),
      source: String(formData.get("source") ?? "manual").trim() || "manual",
      notes: String(formData.get("notes") ?? "").trim()
    };

    const response = await fetch("/api/exchange-rates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Exchange rate save failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Country
          <select disabled={isBusy} value={selectedCountryCode} onChange={(event) => selectCountry(event.target.value)}>
            <option value="">Global / no country</option>
            {countryOptions.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.countryCode} - {country.countryName}
              </option>
            ))}
          </select>
          <input name="countryCode" readOnly type="hidden" value={selectedCountryCode} />
          <input name="countryName" readOnly type="hidden" value={selectedCountryName} />
        </label>
        <label>
          Base Currency
          <input
            disabled={isBusy}
            name="baseCurrency"
            placeholder="USD"
            required
            value={baseCurrency}
            onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())}
          />
        </label>
        <label>
          Quote Currency
          <input defaultValue="KRW" disabled={isBusy} name="quoteCurrency" placeholder="KRW" required />
        </label>
        <label>
          Rate to KRW
          <input disabled={isBusy} min="0" name="rate" placeholder="1380.50" required step="0.000001" type="number" />
        </label>
        <label>
          Effective Date
          <input defaultValue={new Date().toISOString().slice(0, 10)} disabled={isBusy} name="effectiveDate" type="date" />
        </label>
        <label>
          Source
          <input defaultValue="manual" disabled={isBusy} name="source" placeholder="manual, bank, accounting" />
        </label>
      </div>
      <label className="full-width-field">
        Notes
        <textarea disabled={isBusy} name="notes" placeholder="Internal exchange-rate note" rows={2} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Save Exchange Rate
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

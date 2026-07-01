"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCurrencyOptions, mergeCountryReferences } from "@/features/countries/defaults";
import type { CountryReference } from "@/features/countries/types";

type CountryFormState = {
  countryCode: string;
  countryName: string;
  defaultCurrency: string;
  aliases: string;
};

export function CountryReferenceCreateForm({ countries = [] }: { countries?: CountryReference[] }) {
  const initialCountries = useMemo(() => mergeCountryReferences(countries), [countries]);
  const [countryOptions, setCountryOptions] = useState<CountryReference[]>(initialCountries);
  const [selectedCountry, setSelectedCountry] = useState(initialCountries[0]?.countryCode ?? "");
  const [formState, setFormState] = useState<CountryFormState>(() => stateFromCountry(initialCountries[0]));
  const [isCustomCountry, setIsCustomCountry] = useState(false);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const currencyOptions = buildCurrencyOptions(countryOptions, formState.defaultCurrency);

  useEffect(() => {
    let mounted = true;
    fetch("/api/countries")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.data?.length) return;
        const merged = mergeCountryReferences(payload.data);
        setCountryOptions(merged);
        if (!isCustomCountry) {
          const selected = merged.find((country) => country.countryCode === selectedCountry) ?? merged[0];
          setSelectedCountry(selected?.countryCode ?? "");
          setFormState(stateFromCountry(selected));
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  function selectCountry(value: string) {
    setSelectedCountry(value);
    if (value === "__custom__") {
      setIsCustomCountry(true);
      setFormState({ countryCode: "", countryName: "", defaultCurrency: "", aliases: "" });
      return;
    }

    setIsCustomCountry(false);
    const country = countryOptions.find((item) => item.countryCode === value);
    setFormState(stateFromCountry(country));
  }

  function updateField(field: keyof CountryFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = {
      countryCode: String(formData.get("countryCode") ?? formState.countryCode).trim().toUpperCase(),
      countryName: String(formData.get("countryName") ?? formState.countryName).trim(),
      defaultCurrency: String(formData.get("defaultCurrency") ?? formState.defaultCurrency).trim().toUpperCase(),
      aliases: String(formData.get("aliases") ?? "").trim(),
      source: "manual"
    };

    const response = await fetch("/api/countries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Country save failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <label className="full-width-field">
        국가 마스터 프리셋
        <select disabled={isBusy} value={selectedCountry} onChange={(event) => selectCountry(event.target.value)}>
          {countryOptions.map((country) => (
            <option key={country.countryCode} value={country.countryCode}>
              {country.countryCode} - {country.countryName}
              {country.defaultCurrency ? ` (${country.defaultCurrency})` : ""}
            </option>
          ))}
          <option value="__custom__">직접 입력</option>
        </select>
        <span className="subtext">선택한 국가의 Country Code, Country Name, Default Currency가 아래 입력값에 자동 반영됩니다.</span>
      </label>
      <div className="form-grid three-column">
        <label>
          국가 코드
          <input
            disabled={isBusy}
            name="countryCode"
            onChange={(event) => updateField("countryCode", event.target.value.toUpperCase())}
            placeholder="MY"
            readOnly={!isCustomCountry}
            required
            value={formState.countryCode}
          />
        </label>
        <label>
          국가명
          <input
            disabled={isBusy}
            name="countryName"
            onChange={(event) => updateField("countryName", event.target.value)}
            placeholder="Malaysia"
            readOnly={!isCustomCountry}
            required
            value={formState.countryName}
          />
        </label>
        <label>
          기본 통화
          <select
            disabled={isBusy}
            name="defaultCurrency"
            onChange={(event) => updateField("defaultCurrency", event.target.value)}
            value={formState.defaultCurrency}
          >
            <option value="">기본 통화 없음</option>
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="full-width-field">
        별칭
        <input
          disabled={isBusy}
          name="aliases"
          onChange={(event) => updateField("aliases", event.target.value)}
          placeholder="Malay, Malaysia Partner typed names"
          value={formState.aliases}
        />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          국가 저장
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

function stateFromCountry(country: CountryReference | undefined): CountryFormState {
  return {
    countryCode: country?.countryCode ?? "",
    countryName: country?.countryName ?? "",
    defaultCurrency: country?.defaultCurrency ?? "",
    aliases: country?.aliases?.join(", ") ?? ""
  };
}

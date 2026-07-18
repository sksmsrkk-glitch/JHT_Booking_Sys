/**
 * @file 한글 책임: `Exchange Rate Create Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useEffect, useMemo, useState } from "react";
import { buildCurrencyOptions, mergeCountryReferences } from "@/features/countries/defaults";
import type { CountryReference } from "@/features/countries/types";

export function ExchangeRateCreateForm({ countries = [] }: { countries?: CountryReference[] }) {
  const initialCountries = useMemo(() => mergeCountryReferences(countries), [countries]);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [countryOptions, setCountryOptions] = useState<CountryReference[]>(initialCountries);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedCountryName, setSelectedCountryName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const currencyOptions = buildCurrencyOptions(countryOptions, baseCurrency);

  useEffect(() => {
    let mounted = true;
    safeFetch("/api/countries")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.data?.length) return;
        setCountryOptions(mergeCountryReferences(payload.data));
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
    // 국가 마스터에 저장된 기본 통화를 기준통화로 자동 적용합니다.
    // 예: MY - Malaysia 선택 시 기준통화 MYR, TH - Thailand 선택 시 THB.
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

    const response = await safeFetch("/api/exchange-rates", {
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
    requestRouteRefresh();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid exchange-rate-create-grid">
        <label className="exchange-rate-country-field">
          국가
          <select disabled={isBusy} name="countryCode" value={selectedCountryCode} onChange={(event) => selectCountry(event.target.value)}>
            <option value="">전체 / 국가 미지정</option>
            {countryOptions.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.countryCode} - {country.countryName}
                {country.defaultCurrency ? ` (${country.defaultCurrency})` : ""}
              </option>
            ))}
          </select>
          <input name="countryName" readOnly type="hidden" value={selectedCountryName} />
          <span className="subtext">국가 선택 시 Country Code와 기준통화가 공통 마스터 기준으로 연결됩니다.</span>
        </label>
        <label>
          기준 통화
          <select
            disabled={isBusy}
            name="baseCurrency"
            onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())}
            required
            value={baseCurrency}
          >
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label>
          상대 통화
          <select defaultValue="KRW" disabled={isBusy} name="quoteCurrency" required>
            <option value="KRW">KRW</option>
          </select>
        </label>
        <label>
          KRW 환산율
          <input disabled={isBusy} min="0" name="rate" placeholder="1380.50" required step="0.000001" type="number" />
        </label>
        <label>
          적용일
          <input defaultValue={new Date().toISOString().slice(0, 10)} disabled={isBusy} name="effectiveDate" type="date" />
        </label>
        <label className="exchange-rate-source-field">
          출처
          <input defaultValue="manual" disabled={isBusy} name="source" placeholder="manual, bank, accounting" />
        </label>
        <label className="exchange-rate-notes-field">
          메모
          <textarea disabled={isBusy} name="notes" placeholder="Internal exchange-rate note" rows={2} />
        </label>
        <div className="exchange-form-submit-cell">
          <button className="button-primary" disabled={isBusy} type="submit">
            환율 저장
          </button>
          {message ? <span className="danger-text">{message}</span> : null}
        </div>
      </div>
    </form>
  );
}

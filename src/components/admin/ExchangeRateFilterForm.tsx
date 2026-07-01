"use client";

import { useMemo, useState } from "react";
import { buildCurrencyOptions, mergeCountryReferences } from "@/features/countries/defaults";
import type { CountryReference } from "@/features/countries/types";

type ExchangeRateFilterValues = {
  countryCode?: string;
  baseCurrency?: string;
  status?: string;
};

export function ExchangeRateFilterForm({
  countries,
  filters
}: {
  countries: CountryReference[];
  filters: ExchangeRateFilterValues;
}) {
  const countryOptions = useMemo(() => mergeCountryReferences(countries), [countries]);
  const initialCountry = filters.countryCode ?? "";
  const initialDefaultCurrency = countryOptions.find((country) => country.countryCode === initialCountry)?.defaultCurrency ?? "";
  const [countryCode, setCountryCode] = useState(initialCountry);
  const [baseCurrency, setBaseCurrency] = useState(filters.baseCurrency ?? initialDefaultCurrency);
  const currencyOptions = buildCurrencyOptions(countryOptions, baseCurrency);

  function selectCountry(value: string) {
    setCountryCode(value);
    const country = countryOptions.find((item) => item.countryCode === value);
    setBaseCurrency(country?.defaultCurrency ?? "");
  }

  return (
    <form className="toolbar exchange-rate-filter-toolbar" action="/admin/exchange-rates">
      <label className="wide-field">
        국가
        <select name="countryCode" value={countryCode} onChange={(event) => selectCountry(event.target.value)}>
          <option value="">전체 국가 / 공통</option>
          {countryOptions.map((country) => (
            <option key={country.countryCode} value={country.countryCode}>
              {country.countryCode} - {country.countryName}
              {country.defaultCurrency ? ` (${country.defaultCurrency})` : ""}
            </option>
          ))}
        </select>
        <span className="subtext">Country Code + Country Name + Default Currency 공통관리</span>
      </label>
      <label>
        기준 통화
        <select name="baseCurrency" value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)}>
          <option value="">전체 통화</option>
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>
      <label>
        상태
        <select name="status" defaultValue={filters.status ?? "active"}>
          <option value="active">운영중</option>
          <option value="inactive">비활성</option>
          <option value="archived">보관</option>
        </select>
      </label>
      <button className="button-primary" type="submit">
        필터
      </button>
    </form>
  );
}

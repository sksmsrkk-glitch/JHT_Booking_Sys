import type { CountryReference } from "./types";

/*
 * 국가/통화 공통관리의 기본 프리셋입니다.
 *
 * Supabase country_references가 아직 비어 있거나, 파트너 가입처럼 로그인 전 화면에서
 * 국가 선택이 필요할 때 이 목록을 fallback으로 사용합니다. 운영 DB에 같은 countryCode가
 * 저장되면 DB 값이 우선합니다.
 */
export const DEFAULT_COUNTRY_REFERENCES: CountryReference[] = [
  ["MY", "Malaysia", "MYR"],
  ["TH", "Thailand", "THB"],
  ["VN", "Vietnam", "VND"],
  ["ID", "Indonesia", "IDR"],
  ["PH", "Philippines", "PHP"],
  ["SG", "Singapore", "SGD"],
  ["JP", "Japan", "JPY"],
  ["CN", "China", "CNY"],
  ["TW", "Taiwan", "TWD"],
  ["HK", "Hong Kong", "HKD"],
  ["IN", "India", "INR"],
  ["AE", "United Arab Emirates", "AED"],
  ["EG", "Egypt", "EGP"],
  ["US", "United States", "USD"],
  ["AU", "Australia", "AUD"]
].map(([countryCode, countryName, defaultCurrency]) => ({
  countryCode,
  countryName,
  defaultCurrency,
  aliases: [],
  source: "default",
  status: "active",
  createdAt: null
}));

export const COMMON_BASE_CURRENCIES = [
  "KRW",
  "USD",
  "MYR",
  "THB",
  "VND",
  "IDR",
  "PHP",
  "SGD",
  "JPY",
  "CNY",
  "TWD",
  "HKD",
  "INR",
  "AED",
  "EGP",
  "AUD"
];

export function mergeCountryReferences(countries: CountryReference[] = []) {
  const merged = new Map(DEFAULT_COUNTRY_REFERENCES.map((country) => [country.countryCode, country]));
  for (const country of countries) {
    merged.set(country.countryCode, country);
  }
  return [...merged.values()].sort((left, right) => left.countryName.localeCompare(right.countryName));
}

export function buildCurrencyOptions(countries: Array<Pick<CountryReference, "defaultCurrency">> = [], currentCurrency?: string | null) {
  const values = new Set(COMMON_BASE_CURRENCIES);
  for (const country of countries) {
    if (country.defaultCurrency) values.add(country.defaultCurrency);
  }
  if (currentCurrency) values.add(currentCurrency.toUpperCase());
  return [...values].sort();
}

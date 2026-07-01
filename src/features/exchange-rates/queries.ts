import type { ExchangeRateFilters, ExchangeRateListItem } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const EXCHANGE_RATE_STATUSES = ["active", "inactive", "archived"] as const;

export async function listExchangeRates(
  supabase: SupabaseClientLike,
  filters: ExchangeRateFilters = {}
): Promise<ExchangeRateListItem[]> {
  const baseCurrency = normalizeCurrency(filters.baseCurrency);
  const countryCode = normalizeCountry(filters.countryCode);
  const quoteCurrency = normalizeCurrency(filters.quoteCurrency) || "KRW";
  const status = normalizeEnum(filters.status, EXCHANGE_RATE_STATUSES) ?? "active";

  let query = supabase
    .from("exchange_rates")
    .select("id, country_code, country_name, base_currency, quote_currency, rate, effective_date, source, notes, status, created_at")
    .eq("quote_currency", quoteCurrency)
    .eq("status", status)
    .limit(200);

  if (baseCurrency) query = query.eq("base_currency", baseCurrency);
  if (countryCode) query = query.eq("country_code", countryCode);

  const { data, error } = await query.order("effective_date", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapExchangeRate);
}

export async function getLatestExchangeRate(
  supabase: SupabaseClientLike,
  baseCurrency: string,
  quoteCurrency = "KRW",
  countryCode?: string
): Promise<ExchangeRateListItem | null> {
  const normalizedBase = normalizeCurrency(baseCurrency);
  const normalizedQuote = normalizeCurrency(quoteCurrency) || "KRW";
  const normalizedCountry = normalizeCountry(countryCode);

  if (!normalizedBase || normalizedBase === normalizedQuote) {
    return {
      id: "identity",
      countryCode: normalizedCountry || null,
      countryName: null,
      baseCurrency: normalizedBase || normalizedQuote,
      quoteCurrency: normalizedQuote,
      rate: 1,
      effectiveDate: new Date().toISOString().slice(0, 10),
      source: "identity",
      notes: null,
      status: "active",
      createdAt: new Date().toISOString()
    };
  }

  let query = supabase
    .from("exchange_rates")
    .select("id, country_code, country_name, base_currency, quote_currency, rate, effective_date, source, notes, status, created_at")
    .eq("base_currency", normalizedBase)
    .eq("quote_currency", normalizedQuote)
    .eq("status", "active")
    .order("effective_date", { ascending: false })
    .limit(1);

  if (normalizedCountry) query = query.eq("country_code", normalizedCountry);
  else query = query.is("country_code", null);

  let { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);

  if (!data && normalizedCountry) {
    const fallback = await supabase
      .from("exchange_rates")
      .select("id, country_code, country_name, base_currency, quote_currency, rate, effective_date, source, notes, status, created_at")
      .eq("base_currency", normalizedBase)
      .eq("quote_currency", normalizedQuote)
      .eq("status", "active")
      .is("country_code", null)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  return data ? mapExchangeRate(data) : null;
}

function mapExchangeRate(row: any): ExchangeRateListItem {
  return {
    id: row.id,
    countryCode: row.country_code ?? null,
    countryName: row.country_name ?? null,
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    rate: Number(row.rate),
    effectiveDate: row.effective_date,
    source: row.source ?? null,
    notes: row.notes ?? null,
    status: row.status,
    createdAt: row.created_at
  };
}

function normalizeCurrency(value: string | undefined | null) {
  if (!value) return "";
  return value.trim().replace(/[^a-z]/gi, "").slice(0, 8).toUpperCase();
}

function normalizeCountry(value: string | undefined | null) {
  if (!value) return "";
  return value.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 20).toUpperCase();
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

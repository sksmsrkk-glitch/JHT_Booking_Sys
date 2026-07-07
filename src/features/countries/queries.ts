import type { CountryReference, CountryReferenceFilters } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function listCountryReferences(
  supabase: SupabaseClientLike,
  filters: CountryReferenceFilters = {}
): Promise<CountryReference[]> {
  const status = normalizeStatus(filters.status) ?? "active";
  const q = normalizeSearch(filters.q);

  let query = supabase
    .from("country_references")
    .select("country_code, country_name, default_currency, aliases, source, status, created_at")
    .eq("status", status)
    .limit(300);

  if (q) {
    query = query.or(`country_code.ilike.%${q}%,country_name.ilike.%${q}%`);
  }

  const { data, error } = await query.order("country_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCountryReference);
}

export async function resolveCountryReference(
  supabase: SupabaseClientLike,
  rawCountry: string
): Promise<{ countryCode: string; countryName: string; originalCountryName: string; defaultCurrency: string | null }> {
  const originalCountryName = rawCountry.trim();
  const parsed = parseCountryInput(originalCountryName);

  let matched: any = null;
  if (parsed.code) {
    const { data, error } = await supabase
      .from("country_references")
      .select("country_code, country_name, default_currency")
      .eq("country_code", parsed.code)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    matched = data;
  }

  if (!matched && parsed.name) {
    const { data, error } = await supabase
      .from("country_references")
      .select("country_code, country_name, default_currency, aliases")
      .eq("status", "active");
    if (error) throw new Error(error.message);
    const normalizedName = normalizeCountryName(parsed.name);
    matched = (data ?? []).find((country: any) => {
      const aliases = Array.isArray(country.aliases) ? country.aliases : [];
      return (
        normalizeCountryName(country.country_name) === normalizedName ||
        aliases.some((alias: string) => normalizeCountryName(alias) === normalizedName)
      );
    });
  }

  return {
    countryCode: matched?.country_code ?? parsed.code ?? originalCountryName.slice(0, 2).toUpperCase(),
    countryName: matched?.country_name ?? parsed.name ?? originalCountryName,
    originalCountryName,
    defaultCurrency: matched?.default_currency ?? null
  };
}

function mapCountryReference(row: any): CountryReference {
  return {
    countryCode: row.country_code,
    countryName: row.country_name,
    defaultCurrency: row.default_currency ?? null,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    source: row.source,
    status: row.status,
    createdAt: row.created_at
  };
}

function parseCountryInput(value: string) {
  const match = value.match(/^([A-Z]{2})\s+-\s+(.+)$/i);
  if (match) return { code: match[1].toUpperCase(), name: match[2].trim() };
  if (/^[A-Z]{2}$/i.test(value)) return { code: value.toUpperCase(), name: "" };
  return { code: "", name: value.trim() };
}

function normalizeCountryName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSearch(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

function normalizeStatus(value: string | undefined) {
  if (!value) return null;
  return ["active", "inactive", "archived"].includes(value) ? value : null;
}

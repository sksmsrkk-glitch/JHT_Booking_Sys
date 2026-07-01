import { listCountryReferences } from "@/features/countries/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

/*
 * 국가 공통관리 API입니다.
 *
 * 파트너가 입력한 country name은 원문을 보존하되, 내부 운영에서는 countryCode와
 * defaultCurrency를 기준으로 환율, 파트너사, 견적서를 연결합니다. 가입 신청 화면은
 * 로그인 전에도 국가 선택이 필요하므로 GET은 기본 국가 목록을 public fallback으로 제공합니다.
 */
const defaultCountryReferences = [
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // 파트너 가입 신청 전 단계에서는 JWT가 없기 때문에,
    // DB 대신 기본 국가 목록을 내려서 드롭다운/검색 UI가 동작하게 합니다.
    if (!hasAuthSession(request)) {
      return ok(filterDefaultCountries(url.searchParams.get("q")));
    }

    const supabase = createRequestSupabaseClient(request);
    const countries = await listCountryReferences(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? "active"
    });
    return ok(countries);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    // 국가 마스터 수정은 환율과 견적서 기준값을 바꾸는 작업이므로 내부 사용자만 허용합니다.
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const countryCode = normalizeCountryCode(requireString(body.countryCode, "countryCode"));
    const countryName = requireString(body.countryName, "countryName");
    const defaultCurrency = optionalString(body.defaultCurrency)?.toUpperCase() ?? null;

    const { data, error } = await supabase
      .from("country_references")
      .upsert(
        {
          country_code: countryCode,
          country_name: countryName,
          default_currency: defaultCurrency,
          aliases: normalizeAliases(body.aliases),
          source: optionalString(body.source) ?? "manual",
          status: optionalString(body.status) ?? "active",
          created_by: internalUser.profileId
        },
        { onConflict: "country_code" }
      )
      .select("country_code, country_name, default_currency, aliases, source, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "country_reference.upserted",
      entityTable: "country_references",
      entityId: data.country_code,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

function normalizeCountryCode(value: string) {
  // 시스템 내부 기준은 ISO 3166-1 alpha-2 형태의 두 글자 코드입니다.
  // 파트너가 입력한 국가명은 별도 필드/alias로 보존하고, 코드는 정규화해서 관계를 맺습니다.
  const normalized = value.trim().replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
  if (normalized.length !== 2) throw new HttpError(400, "countryCode must be a 2-letter code");
  return normalized;
}

function normalizeAliases(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function hasAuthSession(request: Request) {
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") ?? "";
  return Boolean(authorization || cookie.includes("jht_access_token="));
}

function filterDefaultCountries(query: string | null) {
  const q = query?.trim().toLowerCase();
  if (!q) return defaultCountryReferences;
  return defaultCountryReferences.filter(
    (country) => country.countryCode.toLowerCase().includes(q) || country.countryName.toLowerCase().includes(q)
  );
}

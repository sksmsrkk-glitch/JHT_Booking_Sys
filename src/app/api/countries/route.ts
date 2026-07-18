/**
 * @file 한글 책임: `/api/countries` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listCountryReferences } from "@/features/countries/queries";
import { DEFAULT_COUNTRY_REFERENCES } from "@/features/countries/defaults";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { created, fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

/*
 * 국가 공통관리 API입니다.
 *
 * 파트너가 입력한 country name은 원문을 보존하되, 내부 운영에서는 countryCode와
 * defaultCurrency를 기준으로 환율, 파트너사, 견적서를 연결합니다. 가입 신청 화면은
 * 로그인 전에도 국가 선택이 필요하므로 GET은 active 국가 마스터를 public RLS 범위에서 조회합니다.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // 파트너 가입 신청 전 단계에서는 JWT가 없으므로 public active-select RLS 정책을 사용합니다.
    const supabase = createRequestSupabaseClient(request);
    const countries = await listCountryReferences(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? "active"
    });
    if (countries.length === 0 && isDemoModeEnabled()) {
      return ok(filterDefaultCountries(url.searchParams.get("q")), { headers: countryCacheHeaders });
    }
    // 국가 공통 마스터는 공개 참조 데이터이므로 CDN에서 짧게 캐시하고 장애 시 이전 값을 허용합니다.
    return ok(countries, { headers: countryCacheHeaders });
  } catch (error) {
    if (isDemoModeEnabled()) {
      return ok(filterDefaultCountries(new URL(request.url).searchParams.get("q")), { headers: countryCacheHeaders });
    }
    return fail(error);
  }
}

const countryCacheHeaders = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400"
};

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

function filterDefaultCountries(query: string | null) {
  const q = query?.trim().toLowerCase();
  if (!q) return DEFAULT_COUNTRY_REFERENCES;
  return DEFAULT_COUNTRY_REFERENCES.filter(
    (country) => country.countryCode.toLowerCase().includes(q) || country.countryName.toLowerCase().includes(q)
  );
}

import { listExchangeRates, getLatestExchangeRate } from "@/features/exchange-rates/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

/*
 * 환율 공통관리 API입니다.
 *
 * 견적서마다 국가/통화가 다를 수 있으므로, quote item 화면은 이 API에서
 * 국가별 최신 환율을 조회해 원가 계산에 적용합니다. 환율 생성 시 countryCode와
 * countryName이 함께 들어오면 국가 마스터도 같이 upsert해서 국가/환율 기준을 맞춥니다.
 */
export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const countryCode = url.searchParams.get("countryCode") ?? undefined;
    const baseCurrency = url.searchParams.get("baseCurrency") ?? url.searchParams.get("currency") ?? undefined;
    const quoteCurrency = url.searchParams.get("quoteCurrency") ?? "KRW";

    // 견적 입력 화면에서 "공통 환율 적용"을 누를 때 쓰는 경로입니다.
    // 같은 통화라도 국가별 환율을 따로 관리할 수 있게 countryCode 조건을 함께 받습니다.
    if (url.searchParams.get("latest") === "true") {
      const latest = await getLatestExchangeRate(supabase, baseCurrency ?? "KRW", quoteCurrency, countryCode);
      return ok(latest);
    }

    const rates = await listExchangeRates(supabase, {
      countryCode,
      baseCurrency,
      quoteCurrency,
      status: url.searchParams.get("status") ?? undefined
    });
    return ok(rates);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    // 환율은 모든 견적 금액에 영향을 주므로 내부 사용자만 등록할 수 있습니다.
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);

    const baseCurrency = normalizeCurrency(requireString(body.baseCurrency, "baseCurrency"));
    const quoteCurrency = normalizeCurrency(optionalString(body.quoteCurrency) ?? "KRW");
    const countryCode = optionalString(body.countryCode)?.toUpperCase() ?? null;
    const countryName = optionalString(body.countryName);
    const rate = optionalNumber(body.rate);
    if (!baseCurrency) throw new HttpError(400, "baseCurrency is required");
    if (!quoteCurrency) throw new HttpError(400, "quoteCurrency is required");
    if (!rate || rate <= 0) throw new HttpError(400, "rate must be greater than zero");

    if (countryCode && countryName) {
      // 환율을 등록하면서 새 국가가 들어오면 country_references도 같이 갱신합니다.
      // 이렇게 해야 이후 견적서 country dropdown과 환율 dropdown이 같은 기준을 사용합니다.
      const { error: countryError } = await supabase.from("country_references").upsert(
        {
          country_code: countryCode,
          country_name: countryName,
          default_currency: baseCurrency,
          aliases: normalizeAliases(body.countryAliases),
          source: "exchange_rates",
          status: "active",
          created_by: internalUser.profileId
        },
        { onConflict: "country_code" }
      );
      if (countryError) throw new HttpError(500, countryError.message);
    }

    const { data, error } = await supabase
      .from("exchange_rates")
      .insert({
        base_currency: baseCurrency,
        country_code: countryCode,
        country_name: countryName,
        quote_currency: quoteCurrency,
        rate,
        effective_date: optionalString(body.effectiveDate) ?? new Date().toISOString().slice(0, 10),
        source: optionalString(body.source) ?? "manual",
        notes: optionalString(body.notes),
        status: optionalString(body.status) ?? "active",
        created_by: internalUser.profileId
      })
      .select("id, country_code, country_name, base_currency, quote_currency, rate, effective_date, source, notes, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "exchange_rate.created",
      entityTable: "exchange_rates",
      entityId: data.id,
      afterData: data
    });

    return created({ exchangeRate: data });
  } catch (error) {
    return fail(error);
  }
}

function normalizeCurrency(value: string) {
  return value.trim().replace(/[^a-z]/gi, "").slice(0, 8).toUpperCase();
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return value === undefined || value === null ? null : String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

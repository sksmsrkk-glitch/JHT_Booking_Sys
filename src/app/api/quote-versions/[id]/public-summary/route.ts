/**
 * @file 한글 책임: `/api/quote-versions/[id]/public-summary` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteVersionId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const before = await getQuoteVersion(supabase, quoteVersionId);

    const update = {
      agency_visible_summary: normalizeObject(body.agencyVisibleSummary),
      public_fare_options: normalizeArray(body.publicFareOptions),
      terms_and_conditions: optionalString(body.termsAndConditions)
    };

    const { data, error } = await supabase
      .from("quote_versions")
      .update(update)
      .eq("id", quoteVersionId)
      .select("id, quote_case_id, version_no, agency_visible_summary, public_fare_options, terms_and_conditions")
      .single();

    if (error) throw new HttpError(500, error.message);

    // 내부 엑셀 원가모델 요약은 파트너 비노출 테이블(quote_version_internals)에 저장합니다.
    const excelSourceSummary = normalizeObject(body.excelSourceSummary);
    const { error: internalsError } = await supabase
      .from("quote_version_internals")
      .update({ excel_source_summary: excelSourceSummary })
      .eq("quote_version_id", quoteVersionId);
    if (internalsError) throw new HttpError(500, internalsError.message);

    const responseData = { ...data, excel_source_summary: excelSourceSummary };
    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_version.public_summary_updated",
      entityTable: "quote_versions",
      entityId: quoteVersionId,
      beforeData: before,
      afterData: responseData
    });

    return ok(responseData);
  } catch (error) {
    return fail(error);
  }
}

async function getQuoteVersion(supabase: any, quoteVersionId: string) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, quote_case_id, version_no, status, agency_visible_summary, public_fare_options, terms_and_conditions, quote_version_internals(excel_source_summary)")
    .eq("id", quoteVersionId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Quote version not found");
  if (!["draft", "review"].includes(data.status)) {
    throw new HttpError(409, `Public summary can only be edited while quote version is ${data.status}`);
  }
  const internals = Array.isArray(data.quote_version_internals)
    ? data.quote_version_internals[0]
    : data.quote_version_internals;
  return {
    id: data.id,
    quote_case_id: data.quote_case_id,
    version_no: data.version_no,
    status: data.status,
    agency_visible_summary: data.agency_visible_summary,
    public_fare_options: data.public_fare_options,
    terms_and_conditions: data.terms_and_conditions,
    excel_source_summary: internals?.excel_source_summary ?? {}
  };
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "publicFareOptions must be an array");
  }
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

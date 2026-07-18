/**
 * @file 한글 책임: `/api/agency/inquiries` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireAgencyUser } from "@/lib/api/auth";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { created, fail, HttpError, okPaginated, optionalPositiveInteger, optionalString, readJson, requireString } from "@/lib/api/http";
import { buildPaginationMeta, paginationRange, parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { makeWorkflowCode } from "@/lib/domain/workflow-code.mjs";
import { instrumentApiRoute } from "@/lib/api/telemetry";

const ALLOWED_INQUIRY_TYPES = [
  "new_inquiry",
  "revision_request",
  "booking_request",
  "change_request",
  "cancellation_request",
  "existing_product_inquiry"
];

export const GET = instrumentApiRoute("GET /api/agency/inquiries", async (request: Request) => {
  try {
    const pagination = parsePagination(new URL(request.url).searchParams);
    const { from, to } = paginationRange(pagination);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const { data, error, count } = await supabase
      .from("agency_inquiries")
      .select("id, inquiry_type, title, tour_code, arrival_date, departure_date, period_text, nights_count, flight_details, requested_start_date, requested_end_date, pax_count, tour_type, status, related_quote_case_id, created_at", { count: "exact" })
      .eq("agency_account_id", agencyUser.agencyAccountId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new HttpError(500, error.message);
    const items = data ?? [];
    return okPaginated(items, buildPaginationMeta(pagination, count, items.length));
  } catch (error) {
    return fail(error);
  }
});

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    let agencyUser;
    try {
      agencyUser = await requireAgencyUser(supabase);
    } catch (authError) {
      if (!isDemoModeEnabled()) throw authError;
      const body = await readJson<Record<string, unknown>>(request);
      const title = requireString(body.title, "title");
      const previewCode = makeWorkflowCode({
        countryCode: optionalString(body.countryCode) ?? "MY",
        agencyName: optionalString(body.agencyName) ?? "Agency"
      });
      return created({
        id: `preview-${previewCode.toLowerCase()}`,
        inquiry_type: optionalString(body.inquiryType) ?? "new_inquiry",
        title,
        tour_code: previewCode,
        tourCode: previewCode,
        status: "preview_submitted",
        created_at: new Date().toISOString(),
        preview: true,
        message: "Development preview mode: no database row was written."
      });
    }

    const body = await readJson<Record<string, unknown>>(request);
    const inquiryType = optionalString(body.inquiryType) ?? "new_inquiry";
    if (!ALLOWED_INQUIRY_TYPES.includes(inquiryType)) throw new HttpError(400, "Unsupported inquiryType");
    const title = requireString(body.title, "title");
    const requestPayload = normalizeObject(body.requestPayload);
    const flightDetails = Array.isArray(requestPayload.flightDetails) ? requestPayload.flightDetails : [];
    const { data: agencyAccount, error: agencyError } = await supabase
      .from("agency_accounts")
      .select("id, name, country_code, billing_currency")
      .eq("id", agencyUser.agencyAccountId)
      .single();
    if (agencyError) throw new HttpError(500, agencyError.message);

    const relatedTourCode = optionalString(body.relatedTourCode);
    const startsNewWorkflow = ["new_inquiry", "existing_product_inquiry"].includes(inquiryType);
    if (!startsNewWorkflow && !relatedTourCode) throw new HttpError(400, "Related tour code is required for this inquiry type");
    if (relatedTourCode) await assertWorkflowBelongsToAgency(supabase, relatedTourCode, agencyUser.agencyAccountId);
    const tourCode = relatedTourCode ?? makeWorkflowCode({ countryCode: agencyAccount.country_code ?? "XX", agencyName: agencyAccount.name });

    const canonicalPayload = {
      ...requestPayload,
      tourCode,
      relatedTourCode,
      countryCode: agencyAccount.country_code,
      countryName: requestPayload.countryName ?? null,
      agencyName: agencyAccount.name,
      billingCurrency: agencyAccount.billing_currency
    };
    // 문의, workflow, 첫 메시지, 감사 로그를 인증 사용자를 재검증하는 DB 함수에서 함께 저장합니다.
    const { data: result, error } = await supabase.rpc("submit_agency_inquiry_atomic", {
      p_agency_account_id: agencyUser.agencyAccountId,
      p_agency_user_id: agencyUser.agencyUserId,
      p_inquiry_type: inquiryType,
      p_title: title,
      p_tour_code: tourCode,
      p_arrival_date: optionalString(body.arrivalDate),
      p_departure_date: optionalString(body.departureDate),
      p_period_text: optionalString(body.periodText),
      p_nights_count: optionalPositiveInteger(body.nightsCount, "nightsCount"),
      p_flight_details: flightDetails,
      p_pax_count: optionalPositiveInteger(body.paxCount, "paxCount"),
      p_preferred_language: optionalString(body.preferredLanguage),
      p_tour_type: optionalString(body.tourType),
      p_request_payload: canonicalPayload,
      p_message_body: buildInquiryMessage(body, requestPayload),
      p_idempotency_key: request.headers.get("idempotency-key")?.trim() || null
    });
    if (error) throw new HttpError(500, error.message);
    const inquiry = result?.inquiry;
    if (!inquiry?.id) throw new HttpError(500, "Inquiry was not returned");
    return created({ ...inquiry, tourCode: inquiry.tour_code, existing: Boolean(result?.existing) });
  } catch (error) {
    return fail(error);
  }
}

async function assertWorkflowBelongsToAgency(supabase: any, workflowCode: string, agencyAccountId: string) {
  const { data, error } = await supabase
    .from("workflow_threads")
    .select("id")
    .eq("workflow_code", workflowCode)
    .eq("agency_account_id", agencyAccountId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Related tour code was not found for this partner account");
}

function buildInquiryMessage(body: Record<string, unknown>, requestPayload: Record<string, unknown>) {
  const sections = [
    `Inquiry: ${requireString(body.title, "title")}`,
    optionalString(body.periodText) ? `Period: ${optionalString(body.periodText)}` : null,
    body.paxCount ? `Pax: ${body.paxCount}` : null,
    body.nightsCount ? `Nights: ${body.nightsCount}` : null,
    optionalString(requestPayload.itineraryText) ?? optionalString(body.notes) ?? null
  ];
  return sections.filter(Boolean).join("\n");
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

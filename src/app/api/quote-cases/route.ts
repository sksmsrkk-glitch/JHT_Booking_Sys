/**
 * @file 한글 책임: `/api/quote-cases` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, okPaginated, readJson, requireArray, requireString, requireUuid } from "@/lib/api/http";
import { parsePagination } from "@/lib/api/pagination";
import { makeShareId } from "@/lib/domain/ids";
import { makeWorkflowCode } from "@/lib/domain/workflow-code.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { listQuoteCasePage } from "@/features/quotation/queries";
import { calculateQuoteItemInput, roundMoney, toQuoteItemRow, type QuoteItemInput } from "@/features/quotation/input";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/quote-cases", async (request: Request) => {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const pagination = parsePagination(url.searchParams);
    const quoteCases = await listQuoteCasePage(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      agencyAccountId: url.searchParams.get("agencyAccountId") ?? undefined
    }, pagination);

    return okPaginated(quoteCases.items, quoteCases.pagination);
  } catch (error) {
    return fail(error);
  }
});

export async function POST(request: Request) {
  let supabase: ReturnType<typeof createRequestSupabaseClient> | null = null;
  let createdQuoteCaseId: string | null = null;
  try {
    supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const agencyAccountId = requireUuid(body.agencyAccountId, "agencyAccountId");
    const agencyInquiryId = optionalUuid(body.agencyInquiryId);
    const workflowSource = await resolveWorkflowSource(supabase, agencyAccountId, agencyInquiryId);
    const rawItems = body.items ? requireArray<QuoteItemInput>(body.items, "items") : [];

    const calculatedItems = rawItems.map((item, index) => calculateQuoteItemInput(item, `items[${index}]`));
    const totals = calculatedItems.reduce(
      (current, item) => ({
        cost: current.cost + Number(item.totalCostKrw),
        sell: current.sell + Number(item.totalSellAmount),
        margin: current.margin + Number(item.marginAmount)
      }),
      { cost: 0, sell: 0, margin: 0 }
    );

    const { data: quoteCase, error: quoteCaseError } = await supabase
      .from("quote_cases")
      .insert({
        company_id: requireUuid(body.companyId, "companyId"),
        agency_account_id: agencyAccountId,
        agency_inquiry_id: agencyInquiryId,
        case_code: workflowSource.workflowCode,
        share_id: String(body.shareId ?? makeShareId()),
        tour_name: workflowSource.inquiryTitle ?? requireString(body.tourName, "tourName"),
        tour_type: optionalString(body.tourType),
        status: "quoting",
        currency: optionalString(body.currency) ?? "KRW",
        estimated_pax: optionalNumber(body.estimatedPax),
        start_date: optionalString(body.startDate),
        end_date: optionalString(body.endDate),
        internal_owner_id: internalUser.profileId
      })
      .select("id, case_code, share_id, tour_name, status")
      .single();

    if (quoteCaseError) throw new HttpError(500, quoteCaseError.message);
    createdQuoteCaseId = quoteCase.id;

    const { data: version, error: versionError } = await supabase
      .from("quote_versions")
      .insert({
        quote_case_id: quoteCase.id,
        version_no: 1,
        status: "draft",
        margin_mode: optionalString(body.marginMode) ?? "auto_rate",
        currency: optionalString(body.currency) ?? "KRW",
        exchange_rate_to_krw: optionalNumber(body.exchangeRateToKrw) ?? 1,
        agency_visible_summary: body.agencyVisibleSummary ?? {},
        public_fare_options: Array.isArray(body.publicFareOptions) ? body.publicFareOptions : [],
        public_total_amount: roundMoney(totals.sell),
        terms_and_conditions: optionalString(body.termsAndConditions),
        created_by: internalUser.profileId
      })
      .select("id, version_no, status")
      .single();

    if (versionError) throw new HttpError(500, versionError.message);

    // 내부 원가/마진/기본 마진율은 agency 비노출 테이블에 저장합니다.
    const { error: internalsError } = await supabase.from("quote_version_internals").insert({
      quote_version_id: version.id,
      internal_total_cost_krw: roundMoney(totals.cost),
      internal_total_margin_krw: roundMoney(totals.margin),
      default_margin_rate: optionalNumber(body.defaultMarginRate) ?? 0,
      excel_source_summary: normalizeObject(body.excelSourceSummary)
    });

    if (internalsError) throw new HttpError(500, internalsError.message);

    const exchangeRateSnapshots = body.exchangeRates
      ? requireArray<Record<string, unknown>>(body.exchangeRates, "exchangeRates")
          .map((rate) => ({
            quote_version_id: version.id,
            country_code: optionalString(rate.countryCode)?.toUpperCase() ?? null,
            country_name: optionalString(rate.countryName),
            base_currency: optionalString(rate.baseCurrency)?.toUpperCase() ?? "KRW",
            quote_currency: optionalString(rate.quoteCurrency)?.toUpperCase() ?? "KRW",
            rate: optionalNumber(rate.rate) ?? 1,
            effective_date: optionalString(rate.effectiveDate),
            source_exchange_rate_id: optionalUuidLoose(rate.sourceExchangeRateId),
            source: optionalString(rate.source),
            notes: optionalString(rate.notes)
          }))
          .filter((rate) => rate.base_currency && rate.quote_currency && rate.rate > 0)
      : [];

    if (exchangeRateSnapshots.length > 0) {
      const { error: exchangeRateError } = await supabase.from("quote_exchange_rate_snapshots").insert(exchangeRateSnapshots);
      if (exchangeRateError) throw new HttpError(500, exchangeRateError.message);
    }

    const itineraryInputs = body.itineraryDays
      ? requireArray<Record<string, unknown>>(body.itineraryDays, "itineraryDays").map((day) => ({
          row: {
            quote_version_id: version.id,
            day_no: Number(day.dayNo),
            service_date: day.serviceDate ?? null,
            title: day.title ?? null,
            meal_summary: day.mealSummary ?? {},
            public_description: day.publicDescription ?? null
          },
          internalNotes: optionalString(day.internalNotes)
        }))
      : [];

    const dayIdByDayNo = new Map<number, string>();

    if (itineraryInputs.length > 0) {
      const { data: insertedDays, error: itineraryError } = await supabase
        .from("quote_itinerary_days")
        .insert(itineraryInputs.map((entry) => entry.row))
        .select("id, day_no");
      if (itineraryError) throw new HttpError(500, itineraryError.message);
      for (const day of insertedDays ?? []) {
        dayIdByDayNo.set(Number(day.day_no), day.id);
      }

      // 내부 메모는 파트너 비노출 테이블에 별도 저장합니다.
      const dayInternals = itineraryInputs
        .filter((entry) => entry.internalNotes)
        .map((entry) => ({
          quote_itinerary_day_id: dayIdByDayNo.get(entry.row.day_no),
          internal_notes: entry.internalNotes
        }))
        .filter((entry) => entry.quote_itinerary_day_id);
      if (dayInternals.length > 0) {
        const { error: dayInternalsError } = await supabase
          .from("quote_itinerary_day_internals")
          .insert(dayInternals);
        if (dayInternalsError) throw new HttpError(500, dayInternalsError.message);
      }
    }

    if (calculatedItems.length > 0) {
      const quoteItemRows = calculatedItems.map((item, index) => {
        const row = toQuoteItemRow(version.id, item);
        const dayNo = optionalNumber(rawItems[index]?.itineraryDayNo);
        return dayNo ? { ...row, itinerary_day_id: dayIdByDayNo.get(dayNo) ?? row.itinerary_day_id } : row;
      });

      const { error: itemError } = await supabase.from("quote_items").insert(quoteItemRows);
      if (itemError) throw new HttpError(500, itemError.message);
    }

    if (agencyInquiryId) {
      const { error: inquiryLinkError } = await supabase
        .from("agency_inquiries")
        .update({ related_quote_case_id: quoteCase.id, status: "in_review" })
        .eq("id", agencyInquiryId)
        .is("related_quote_case_id", null);
      if (inquiryLinkError) throw new HttpError(500, inquiryLinkError.message);
    }

    const { error: workflowLinkError } = await supabase
      .from("workflow_threads")
      .upsert(
        {
          workflow_code: workflowSource.workflowCode,
          agency_account_id: agencyAccountId,
          agency_inquiry_id: agencyInquiryId,
          quote_case_id: quoteCase.id,
          title: quoteCase.tour_name,
          updated_by: internalUser.profileId,
          updated_at: new Date().toISOString()
        },
        { onConflict: "workflow_code" }
      );
    if (workflowLinkError) throw new HttpError(500, workflowLinkError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_case.created",
      entityTable: "quote_cases",
      entityId: quoteCase.id,
      afterData: { quoteCase, version, itemCount: calculatedItems.length }
    });

    createdQuoteCaseId = null;
    return created({ quoteCase, version, totals });
  } catch (error) {
    // 하위 버전·원가·일정·아이템 중 하나라도 실패하면 cascade 삭제로 부분 견적을 정리합니다.
    if (supabase && createdQuoteCaseId) {
      await supabase.from("quote_cases").delete().eq("id", createdQuoteCaseId);
    }
    return fail(error);
  }
}

async function resolveWorkflowSource(supabase: any, agencyAccountId: string, agencyInquiryId: string | null) {
  const { data: agency, error: agencyError } = await supabase
    .from("agency_accounts")
    .select("id, name, country_code")
    .eq("id", agencyAccountId)
    .maybeSingle();

  if (agencyError) throw new HttpError(500, agencyError.message);
  if (!agency) throw new HttpError(404, "Agency account not found");

  if (!agencyInquiryId) {
    return {
      workflowCode: makeWorkflowCode({ countryCode: agency.country_code ?? "XX", agencyName: agency.name }),
      inquiryTitle: null
    };
  }

  const { data: inquiry, error: inquiryError } = await supabase
    .from("agency_inquiries")
    .select("id, agency_account_id, title, tour_code, related_quote_case_id")
    .eq("id", agencyInquiryId)
    .maybeSingle();

  if (inquiryError) throw new HttpError(500, inquiryError.message);
  if (!inquiry || inquiry.agency_account_id !== agencyAccountId) {
    throw new HttpError(404, "Agency inquiry not found for this agency");
  }
  if (inquiry.related_quote_case_id) {
    throw new HttpError(409, "This inquiry is already linked to a quote case");
  }
  if (!inquiry.tour_code) {
    throw new HttpError(409, "Inquiry does not have a canonical workflow code");
  }

  return { workflowCode: inquiry.tour_code, inquiryTitle: inquiry.title };
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

function optionalUuid(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, "agencyInquiryId");
}

function optionalUuidLoose(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

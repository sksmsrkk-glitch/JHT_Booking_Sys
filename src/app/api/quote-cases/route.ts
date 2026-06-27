import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson, requireArray, requireString, requireUuid } from "@/lib/api/http";
import { makeCaseCode, makeShareId } from "@/lib/domain/ids";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { listQuoteCases } from "@/features/quotation/queries";
import { calculateQuoteItemInput, roundMoney, toQuoteItemRow, type QuoteItemInput } from "@/features/quotation/input";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const quoteCases = await listQuoteCases(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      agencyAccountId: url.searchParams.get("agencyAccountId") ?? undefined
    });

    return ok(quoteCases);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
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
        agency_account_id: requireUuid(body.agencyAccountId, "agencyAccountId"),
        agency_inquiry_id: optionalUuid(body.agencyInquiryId),
        case_code: String(body.caseCode ?? makeCaseCode()),
        share_id: String(body.shareId ?? makeShareId()),
        tour_name: requireString(body.tourName, "tourName"),
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

    const { data: version, error: versionError } = await supabase
      .from("quote_versions")
      .insert({
        quote_case_id: quoteCase.id,
        version_no: 1,
        status: "draft",
        margin_mode: optionalString(body.marginMode) ?? "auto_rate",
        default_margin_rate: optionalNumber(body.defaultMarginRate) ?? 0,
        currency: optionalString(body.currency) ?? "KRW",
        exchange_rate_to_krw: optionalNumber(body.exchangeRateToKrw) ?? 1,
        agency_visible_summary: body.agencyVisibleSummary ?? {},
        public_fare_options: Array.isArray(body.publicFareOptions) ? body.publicFareOptions : [],
        excel_source_summary: normalizeObject(body.excelSourceSummary),
        public_total_amount: roundMoney(totals.sell),
        internal_total_cost_krw: roundMoney(totals.cost),
        internal_total_margin_krw: roundMoney(totals.margin),
        terms_and_conditions: optionalString(body.termsAndConditions),
        created_by: internalUser.profileId
      })
      .select("id, version_no, status")
      .single();

    if (versionError) throw new HttpError(500, versionError.message);

    const itineraryRows = body.itineraryDays
      ? requireArray<Record<string, unknown>>(body.itineraryDays, "itineraryDays").map((day) => ({
          quote_version_id: version.id,
          day_no: Number(day.dayNo),
          service_date: day.serviceDate ?? null,
          title: day.title ?? null,
          meal_summary: day.mealSummary ?? {},
          public_description: day.publicDescription ?? null,
          internal_notes: day.internalNotes ?? null
        }))
      : [];

    if (itineraryRows.length > 0) {
      const { error: itineraryError } = await supabase.from("quote_itinerary_days").insert(itineraryRows);
      if (itineraryError) throw new HttpError(500, itineraryError.message);
    }

    if (calculatedItems.length > 0) {
      const quoteItemRows = calculatedItems.map((item) => toQuoteItemRow(version.id, item));

      const { error: itemError } = await supabase.from("quote_items").insert(quoteItemRows);
      if (itemError) throw new HttpError(500, itemError.message);
    }

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_case.created",
      entityTable: "quote_cases",
      entityId: quoteCase.id,
      afterData: { quoteCase, version, itemCount: calculatedItems.length }
    });

    return created({ quoteCase, version, totals });
  } catch (error) {
    return fail(error);
  }
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

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

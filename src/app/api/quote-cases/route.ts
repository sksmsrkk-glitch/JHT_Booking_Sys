import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireArray, requireString, requireUuid } from "@/lib/api/http";
import { makeCaseCode, makeShareId } from "@/lib/domain/ids";
import { calculateQuoteItem } from "@/lib/domain/quotation.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type QuoteItemInput = Record<string, unknown>;

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const rawItems = body.items ? requireArray<QuoteItemInput>(body.items, "items") : [];

    const calculatedItems = rawItems.map((item, index) => calculateInputItem(item, index));
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
        agency_inquiry_id: body.agencyInquiryId ?? null,
        case_code: String(body.caseCode ?? makeCaseCode()),
        share_id: String(body.shareId ?? makeShareId()),
        tour_name: requireString(body.tourName, "tourName"),
        tour_type: body.tourType ?? null,
        status: "quoting",
        currency: body.currency ?? "KRW",
        estimated_pax: body.estimatedPax ?? null,
        start_date: body.startDate ?? null,
        end_date: body.endDate ?? null,
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
        margin_mode: body.marginMode ?? "auto_rate",
        default_margin_rate: body.defaultMarginRate ?? 0,
        currency: body.currency ?? "KRW",
        exchange_rate_to_krw: body.exchangeRateToKrw ?? 1,
        agency_visible_summary: body.agencyVisibleSummary ?? {},
        public_total_amount: roundMoney(totals.sell),
        internal_total_cost_krw: roundMoney(totals.cost),
        internal_total_margin_krw: roundMoney(totals.margin),
        terms_and_conditions: body.termsAndConditions ?? null,
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
      const quoteItemRows = calculatedItems.map((item) => ({
        quote_version_id: version.id,
        item_category: item.itemCategory,
        source_supplier_product_id: item.sourceSupplierProductId,
        source_supplier_price_id: item.sourceSupplierPriceId,
        snapshot_item_name: item.snapshotItemName,
        snapshot_supplier_name: item.snapshotSupplierName,
        snapshot_cost_currency: item.snapshotCostCurrency,
        snapshot_unit_cost_amount: item.snapshotCostAmount,
        exchange_rate_to_krw: item.exchangeRateToKrw,
        pricing_unit: item.pricingUnit,
        quantity: item.quantity,
        pax_count: item.paxCount,
        margin_mode: item.marginMode,
        margin_rate: item.marginRate,
        manual_margin_amount: item.manualMarginAmount,
        total_cost_krw: item.totalCostKrw,
        total_sell_amount: item.totalSellAmount,
        partner_visible_notes: item.partnerVisibleNotes,
        internal_notes: item.internalNotes
      }));

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

function calculateInputItem(item: QuoteItemInput, index: number) {
  const calculated = calculateQuoteItem({
    sourceSupplierProductId: item.sourceSupplierProductId ?? null,
    sourceSupplierPriceId: item.sourceSupplierPriceId ?? null,
    snapshotItemName: requireString(item.snapshotItemName, `items[${index}].snapshotItemName`),
    snapshotSupplierName: item.snapshotSupplierName ?? null,
    snapshotCostCurrency: item.snapshotCostCurrency ?? "KRW",
    unitCostAmount: item.snapshotUnitCostAmount ?? item.unitCostAmount ?? 0,
    exchangeRateToKrw: item.exchangeRateToKrw ?? 1,
    quantity: item.quantity ?? 1,
    paxCount: item.paxCount ?? 1,
    pricingUnit: item.pricingUnit ?? "per_group",
    margin: item.margin ?? { mode: "auto_rate", rate: 0 }
  });

  return {
    ...calculated,
    itemCategory: requireString(item.itemCategory, `items[${index}].itemCategory`),
    partnerVisibleNotes: item.partnerVisibleNotes ?? null,
    internalNotes: item.internalNotes ?? null
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

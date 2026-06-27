import { calculateQuoteItemInput, roundMoney, toQuoteItemRow } from "@/features/quotation/input";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type QuoteVersionRow = {
  id: string;
  quote_case_id: string;
  version_no: number;
  status: string;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteCaseId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const version = await resolveDraftVersion(supabase, quoteCaseId, body.quoteVersionId);
    const calculatedItem = calculateQuoteItemInput(body, "item");
    const quoteItemRow = toQuoteItemRow(version.id, calculatedItem);

    const { data: quoteItem, error: insertError } = await supabase
      .from("quote_items")
      .insert(quoteItemRow)
      .select(
        "id, item_category, snapshot_item_name, snapshot_supplier_name, snapshot_cost_currency, snapshot_unit_cost_amount, exchange_rate_to_krw, pricing_unit, quantity, pax_count, margin_mode, margin_rate, manual_margin_amount, total_cost_krw, total_sell_amount, partner_visible_notes, internal_notes, service_section, calculation_mode, excel_cell_ref, excel_formula, manual_override, supplier_cost_breakdown, public_breakdown"
      )
      .single();

    if (insertError) throw new HttpError(500, insertError.message);

    const totals = await recalculateVersionTotals(supabase, version.id);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_item.created",
      entityTable: "quote_items",
      entityId: quoteItem.id,
      afterData: { quoteCaseId, quoteVersionId: version.id, quoteItem, totals }
    });

    return created({ quoteItem, quoteVersion: { id: version.id, versionNo: version.version_no, totals } });
  } catch (error) {
    return fail(error);
  }
}

async function resolveDraftVersion(supabase: any, quoteCaseId: string, rawQuoteVersionId: unknown) {
  if (rawQuoteVersionId) {
    const quoteVersionId = requireUuid(rawQuoteVersionId, "quoteVersionId");
    const { data, error } = await supabase
      .from("quote_versions")
      .select("id, quote_case_id, version_no, status")
      .eq("id", quoteVersionId)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data || data.quote_case_id !== quoteCaseId) throw new HttpError(404, "Quote version not found");
    if (data.status !== "draft") throw new HttpError(409, `Quote version ${data.version_no} is ${data.status}`);
    return data as QuoteVersionRow;
  }

  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, quote_case_id, version_no, status")
    .eq("quote_case_id", quoteCaseId)
    .eq("status", "draft")
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(409, "No draft quote version is available for item changes");
  return data as QuoteVersionRow;
}

async function recalculateVersionTotals(supabase: any, quoteVersionId: string) {
  const { data: items, error: itemError } = await supabase
    .from("quote_items")
    .select("total_cost_krw, total_sell_amount")
    .eq("quote_version_id", quoteVersionId);

  if (itemError) throw new HttpError(500, itemError.message);

  const totals = (items ?? []).reduce(
    (current: { cost: number; sell: number }, item: { total_cost_krw: unknown; total_sell_amount: unknown }) => ({
      cost: current.cost + Number(item.total_cost_krw ?? 0),
      sell: current.sell + Number(item.total_sell_amount ?? 0)
    }),
    { cost: 0, sell: 0 }
  );

  const nextTotals = {
    publicTotalAmount: roundMoney(totals.sell),
    internalTotalCostKrw: roundMoney(totals.cost),
    internalTotalMarginKrw: roundMoney(totals.sell - totals.cost)
  };

  const { error: updateError } = await supabase
    .from("quote_versions")
    .update({
      public_total_amount: nextTotals.publicTotalAmount,
      internal_total_cost_krw: nextTotals.internalTotalCostKrw,
      internal_total_margin_krw: nextTotals.internalTotalMarginKrw
    })
    .eq("id", quoteVersionId);

  if (updateError) throw new HttpError(500, updateError.message);
  return nextTotals;
}

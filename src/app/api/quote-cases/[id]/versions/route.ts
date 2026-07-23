/**
 * @file 한글 책임: `/api/quote-cases/[id]/versions` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteCaseId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const quoteCase = await getQuoteCase(supabase, quoteCaseId);
    await assertNoDraftVersion(supabase, quoteCaseId);

    const { nextVersionNo, sourceVersion } = await resolveVersionPlan(supabase, quoteCaseId, body.copyFromVersionId);

    const { data: version, error: versionError } = await supabase
      .from("quote_versions")
      .insert({
        quote_case_id: quoteCaseId,
        version_no: nextVersionNo,
        status: "draft",
        margin_mode: sourceVersion?.margin_mode ?? "auto_rate",
        currency: sourceVersion?.currency ?? quoteCase.currency ?? "KRW",
        exchange_rate_to_krw: Number(sourceVersion?.exchange_rate_to_krw ?? 1),
        agency_visible_summary: sourceVersion?.agency_visible_summary ?? {},
        public_fare_options: sourceVersion?.public_fare_options ?? [],
        public_total_amount: Number(sourceVersion?.public_total_amount ?? 0),
        terms_and_conditions: sourceVersion?.terms_and_conditions ?? null,
        created_by: internalUser.profileId
      })
      .select("id, quote_case_id, version_no, status")
      .single();

    if (versionError) throw new HttpError(500, versionError.message);

    // 내부 원가/마진/기본 마진율은 별도 internal-only 테이블에 복사합니다.
    const sourceInternals = sourceVersion ? await getVersionInternals(supabase, sourceVersion.id) : null;
    const { error: internalsError } = await supabase.from("quote_version_internals").insert({
      quote_version_id: version.id,
      internal_total_cost_krw: Number(sourceInternals?.internal_total_cost_krw ?? 0),
      internal_total_margin_krw: Number(sourceInternals?.internal_total_margin_krw ?? 0),
      default_margin_rate: Number(sourceInternals?.default_margin_rate ?? 0),
      excel_source_summary: sourceInternals?.excel_source_summary ?? {}
    });

    if (internalsError) throw new HttpError(500, internalsError.message);

    const copied = sourceVersion
      ? await copyVersionChildren(supabase, sourceVersion.id, version.id)
      : { dayCount: 0, itemCount: 0, presentationBlockCount: 0 };

    const { error: caseUpdateError } = await supabase
      .from("quote_cases")
      .update({ status: "quoting" })
      .eq("id", quoteCaseId);

    if (caseUpdateError) throw new HttpError(500, caseUpdateError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_version.created",
      entityTable: "quote_versions",
      entityId: version.id,
      afterData: { version, sourceVersionId: sourceVersion?.id ?? null, copied }
    });

    return created({ version, sourceVersionId: sourceVersion?.id ?? null, copied });
  } catch (error) {
    return fail(error);
  }
}

async function getVersionInternals(supabase: any, quoteVersionId: string) {
  const { data, error } = await supabase
    .from("quote_version_internals")
    .select("internal_total_cost_krw, internal_total_margin_krw, default_margin_rate, excel_source_summary")
    .eq("quote_version_id", quoteVersionId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  return data;
}

async function getQuoteCase(supabase: any, quoteCaseId: string) {
  const { data, error } = await supabase
    .from("quote_cases")
    .select("id, currency")
    .eq("id", quoteCaseId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Quote case not found");
  return data;
}

async function assertNoDraftVersion(supabase: any, quoteCaseId: string) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, version_no")
    .eq("quote_case_id", quoteCaseId)
    .eq("status", "draft")
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (data) throw new HttpError(409, `Draft version ${data.version_no} already exists`);
}

async function resolveVersionPlan(supabase: any, quoteCaseId: string, rawCopyFromVersionId: unknown) {
  const { data: latestVersion, error: latestError } = await supabase
    .from("quote_versions")
    .select(
      "id, quote_case_id, version_no, margin_mode, currency, exchange_rate_to_krw, agency_visible_summary, public_fare_options, public_total_amount, terms_and_conditions"
    )
    .eq("quote_case_id", quoteCaseId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new HttpError(500, latestError.message);

  const nextVersionNo = Number(latestVersion?.version_no ?? 0) + 1;
  if (!rawCopyFromVersionId) return { nextVersionNo, sourceVersion: latestVersion ?? null };

  const copyFromVersionId = requireUuid(rawCopyFromVersionId, "copyFromVersionId");
  const { data: sourceVersion, error: sourceError } = await supabase
    .from("quote_versions")
    .select(
      "id, quote_case_id, version_no, margin_mode, currency, exchange_rate_to_krw, agency_visible_summary, public_fare_options, public_total_amount, terms_and_conditions"
    )
    .eq("id", copyFromVersionId)
    .maybeSingle();

  if (sourceError) throw new HttpError(500, sourceError.message);
  if (!sourceVersion || sourceVersion.quote_case_id !== quoteCaseId) {
    throw new HttpError(404, "Source quote version not found");
  }

  return { nextVersionNo, sourceVersion };
}

async function copyVersionChildren(supabase: any, sourceVersionId: string, targetVersionId: string) {
  const dayIdMap = new Map<string, string>();
  const { data: sourceDays, error: dayError } = await supabase
    .from("quote_itinerary_days")
    .select("id, day_no, service_date, title, meal_summary, public_description, quote_itinerary_day_internals(internal_notes)")
    .eq("quote_version_id", sourceVersionId)
    .order("day_no", { ascending: true });

  if (dayError) throw new HttpError(500, dayError.message);

  for (const day of sourceDays ?? []) {
    const { data: copiedDay, error: copyDayError } = await supabase
      .from("quote_itinerary_days")
      .insert({
        quote_version_id: targetVersionId,
        day_no: day.day_no,
        service_date: day.service_date,
        title: day.title,
        meal_summary: day.meal_summary ?? {},
        public_description: day.public_description
      })
      .select("id")
      .single();

    if (copyDayError) throw new HttpError(500, copyDayError.message);
    dayIdMap.set(day.id, copiedDay.id);

    // 내부 메모(파트너 비노출 테이블)도 함께 복사합니다.
    const sourceNotes = extractDayInternalNotes(day);
    if (sourceNotes) {
      const { error: copyNotesError } = await supabase
        .from("quote_itinerary_day_internals")
        .insert({ quote_itinerary_day_id: copiedDay.id, internal_notes: sourceNotes });
      if (copyNotesError) throw new HttpError(500, copyNotesError.message);
    }

    await copyRouteSegments(supabase, day.id, copiedDay.id);
  }

  const itemCount = await copyQuoteItems(supabase, sourceVersionId, targetVersionId, dayIdMap);
  const presentationBlockCount = await copyPresentationBlocks(supabase, sourceVersionId, targetVersionId, dayIdMap);
  return { dayCount: sourceDays?.length ?? 0, itemCount, presentationBlockCount };
}

function extractDayInternalNotes(day: any): string | null {
  const embedded = day?.quote_itinerary_day_internals;
  const record = Array.isArray(embedded) ? embedded[0] : embedded;
  const notes = record?.internal_notes;
  return typeof notes === "string" && notes.trim().length > 0 ? notes : null;
}

async function copyRouteSegments(supabase: any, sourceDayId: string, targetDayId: string) {
  const { data: segments, error } = await supabase
    .from("route_segments")
    .select(
      "seq, origin_label, destination_label, origin_place_id, destination_place_id, travel_minutes, distance_meters, provider, provider_payload, manual_override"
    )
    .eq("quote_itinerary_day_id", sourceDayId)
    .order("seq", { ascending: true });

  if (error) throw new HttpError(500, error.message);
  if (!segments || segments.length === 0) return;

  const { error: insertError } = await supabase.from("route_segments").insert(
    segments.map((segment: any) => ({
      ...segment,
      quote_itinerary_day_id: targetDayId
    }))
  );

  if (insertError) throw new HttpError(500, insertError.message);
}

async function copyQuoteItems(
  supabase: any,
  sourceVersionId: string,
  targetVersionId: string,
  dayIdMap: Map<string, string>
) {
  const { data: items, error } = await supabase
    .from("quote_items")
    .select(
      "itinerary_day_id, source_supplier_product_id, source_supplier_price_id, item_category, snapshot_item_name, snapshot_supplier_name, snapshot_cost_currency, snapshot_unit_cost_amount, exchange_rate_to_krw, pricing_unit, quantity, pax_count, margin_mode, margin_rate, manual_margin_amount, total_cost_krw, total_sell_amount, partner_visible_notes, internal_notes, service_section, calculation_mode, excel_cell_ref, excel_formula, manual_override, supplier_cost_breakdown, public_breakdown"
    )
    .eq("quote_version_id", sourceVersionId);

  if (error) throw new HttpError(500, error.message);
  if (!items || items.length === 0) return 0;

  const { error: insertError } = await supabase.from("quote_items").insert(
    items.map((item: any) => ({
      ...item,
      quote_version_id: targetVersionId,
      itinerary_day_id: item.itinerary_day_id ? dayIdMap.get(item.itinerary_day_id) ?? null : null
    }))
  );

  if (insertError) throw new HttpError(500, insertError.message);
  return items.length;
}

async function copyPresentationBlocks(
  supabase: any,
  sourceVersionId: string,
  targetVersionId: string,
  dayIdMap: Map<string, string>
) {
  const { data: blocks, error } = await supabase
    .from("quote_presentation_blocks")
    .select(
      "quote_itinerary_day_id, source_supplier_media_id, block_type, display_context, title, description, image_storage_path, image_url, alt_text, sort_order, is_public, metadata"
    )
    .eq("quote_version_id", sourceVersionId);

  if (error) throw new HttpError(500, error.message);
  if (!blocks || blocks.length === 0) return 0;

  const { error: insertError } = await supabase.from("quote_presentation_blocks").insert(
    blocks.map((block: any) => ({
      ...block,
      quote_version_id: targetVersionId,
      quote_itinerary_day_id: block.quote_itinerary_day_id ? dayIdMap.get(block.quote_itinerary_day_id) ?? null : null
    }))
  );

  if (insertError) throw new HttpError(500, insertError.message);
  return blocks.length;
}

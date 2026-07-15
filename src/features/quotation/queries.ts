import type {
  QuoteCaseDetail,
  QuoteCaseFilters,
  QuoteExportDetail,
  QuoteCaseListItem,
  QuoteItemDetail,
  QuoteItineraryDayDetail,
  QuotePresentationBlockDetail,
  QuoteRequestTimelineItem,
  QuoteRouteSegmentDetail,
  QuoteVersionDetail
} from "./types";
import {
  buildPaginationMeta,
  paginationRange,
  type PaginatedResult,
  type PaginationInput
} from "@/lib/api/pagination";

type SupabaseClientLike = {
  from: (table: string) => any;
};

const quoteCaseListColumns =
  "id, case_code, share_id, tour_name, tour_type, status, currency, estimated_pax, start_date, end_date, agency_account_id, created_at, agency_accounts(name), quote_versions(id, version_no, status, public_total_amount, created_at)";

export const QUOTE_STATUSES = [
  "new",
  "triage",
  "quoting",
  "sent",
  "revision_requested",
  "accepted",
  "cancelled",
  "expired"
];

export async function listQuoteCases(
  supabase: SupabaseClientLike,
  filters: QuoteCaseFilters = {}
): Promise<QuoteCaseListItem[]> {
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, QUOTE_STATUSES);

  let query = supabase
    .from("quote_cases")
    .select(quoteCaseListColumns)
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  if (filters.agencyAccountId) {
    query = query.eq("agency_account_id", filters.agencyAccountId);
  }

  if (q) {
    query = query.or(`case_code.ilike.%${q}%,tour_name.ilike.%${q}%,share_id.ilike.%${q}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapQuoteCaseListItem);
}

export async function listQuoteCasePage(
  supabase: SupabaseClientLike,
  filters: QuoteCaseFilters,
  pagination: PaginationInput
): Promise<PaginatedResult<QuoteCaseListItem>> {
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, QUOTE_STATUSES);
  const { from, to } = paginationRange(pagination);

  let query = supabase
    .from("quote_cases")
    .select(quoteCaseListColumns, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (filters.agencyAccountId) query = query.eq("agency_account_id", filters.agencyAccountId);
  if (q) query = query.or(`case_code.ilike.%${q}%,tour_name.ilike.%${q}%,share_id.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapQuoteCaseListItem);
  return { items, pagination: buildPaginationMeta(pagination, count, items.length) };
}

export async function getQuoteCaseDetail(
  supabase: SupabaseClientLike,
  quoteCaseId: string
): Promise<QuoteCaseDetail | null> {
  const { data: quoteCase, error: quoteError } = await supabase
    .from("quote_cases")
    .select(
      "id, case_code, share_id, tour_name, tour_type, status, currency, estimated_pax, start_date, end_date, agency_account_id, created_at, agency_accounts(name), quote_versions(id, version_no, status, public_total_amount, created_at)"
    )
    .eq("id", quoteCaseId)
    .maybeSingle();

  if (quoteError) throw new Error(quoteError.message);
  if (!quoteCase) return null;

  const { data: versions, error: versionError } = await supabase
    .from("quote_versions")
    .select(
      "id, version_no, status, margin_mode, currency, exchange_rate_to_krw, agency_visible_summary, public_fare_options, excel_source_summary, public_total_amount, terms_and_conditions, sent_at, accepted_at, created_at, quote_version_internals(internal_total_cost_krw, internal_total_margin_krw, default_margin_rate), quote_itinerary_days(id, day_no, service_date, title, public_description, internal_notes, route_segments(id, seq, origin_label, destination_label, travel_minutes, distance_meters, provider, manual_override)), quote_items(id, item_category, snapshot_item_name, snapshot_supplier_name, snapshot_cost_currency, snapshot_unit_cost_amount, exchange_rate_to_krw, pricing_unit, quantity, pax_count, margin_mode, margin_rate, manual_margin_amount, total_cost_krw, total_sell_amount, partner_visible_notes, internal_notes, service_section, calculation_mode, excel_cell_ref, excel_formula, manual_override, supplier_cost_breakdown, public_breakdown), quote_presentation_blocks(id, quote_itinerary_day_id, source_supplier_media_id, block_type, display_context, title, description, image_storage_path, image_url, alt_text, sort_order, is_public, metadata), quote_exports(id, export_type, storage_path, status, error_message, created_at)"
    )
    .eq("quote_case_id", quoteCaseId)
    .order("version_no", { ascending: false });

  if (versionError) throw new Error(versionError.message);

  const { data: inquiries, error: inquiryError } = await supabase
    .from("agency_inquiries")
    .select("id, inquiry_type, title, status, source_channel, request_payload, created_at")
    .eq("related_quote_case_id", quoteCaseId)
    .order("created_at", { ascending: false });

  if (inquiryError) throw new Error(inquiryError.message);

  return {
    ...mapQuoteCaseListItem(quoteCase),
    versions: (versions ?? []).map(mapQuoteVersionDetail),
    requestTimeline: (inquiries ?? []).map(mapQuoteRequestTimelineItem)
  };
}

function mapQuoteCaseListItem(row: any): QuoteCaseListItem {
  const versions = Array.isArray(row.quote_versions) ? row.quote_versions : [];
  const latestVersion = [...versions].sort((left, right) => Number(right.version_no) - Number(left.version_no))[0];

  return {
    id: row.id,
    caseCode: row.case_code,
    shareId: row.share_id,
    tourName: row.tour_name,
    tourType: row.tour_type ?? null,
    status: row.status,
    currency: row.currency,
    estimatedPax: row.estimated_pax ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    agencyAccountId: row.agency_account_id,
    agencyName: row.agency_accounts?.name ?? null,
    versionCount: versions.length,
    latestVersionStatus: latestVersion?.status ?? null,
    publicTotalAmount:
      latestVersion?.public_total_amount === undefined || latestVersion?.public_total_amount === null
        ? null
        : Number(latestVersion.public_total_amount),
    createdAt: row.created_at
  };
}

function resolveInternals(row: any): { internal_total_cost_krw?: number; internal_total_margin_krw?: number; default_margin_rate?: number } {
  // PostgREST 1:1 임베드는 객체 또는 단일 요소 배열로 올 수 있어 둘 다 처리합니다.
  const internals = row.quote_version_internals;
  if (Array.isArray(internals)) return internals[0] ?? {};
  return internals ?? {};
}

function mapQuoteVersionDetail(row: any): QuoteVersionDetail {
  const presentationBlocks = (row.quote_presentation_blocks ?? []).map(mapQuotePresentationBlockDetail);

  return {
    id: row.id,
    versionNo: row.version_no,
    status: row.status,
    marginMode: row.margin_mode,
    defaultMarginRate: Number(resolveInternals(row).default_margin_rate ?? 0),
    currency: row.currency,
    exchangeRateToKrw: Number(row.exchange_rate_to_krw ?? 1),
    agencyVisibleSummary: row.agency_visible_summary ?? {},
    publicFareOptions: Array.isArray(row.public_fare_options) ? row.public_fare_options : [],
    excelSourceSummary: row.excel_source_summary ?? {},
    publicTotalAmount: Number(row.public_total_amount ?? 0),
    internalTotalCostKrw: Number(resolveInternals(row).internal_total_cost_krw ?? 0),
    internalTotalMarginKrw: Number(resolveInternals(row).internal_total_margin_krw ?? 0),
    termsAndConditions: row.terms_and_conditions ?? null,
    sentAt: row.sent_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    createdAt: row.created_at,
    itineraryDays: (row.quote_itinerary_days ?? []).map((day: any) =>
      mapQuoteItineraryDayDetail(
        day,
        presentationBlocks.filter((block: QuotePresentationBlockDetail) => block.quoteItineraryDayId === day.id)
      )
    ),
    items: (row.quote_items ?? []).map(mapQuoteItemDetail),
    exports: (row.quote_exports ?? []).map(mapQuoteExportDetail),
    presentationBlocks
  };
}

function mapQuoteExportDetail(row: any): QuoteExportDetail {
  return {
    id: row.id,
    exportType: row.export_type,
    storagePath: row.storage_path ?? null,
    status: row.status,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at
  };
}

function mapQuoteItineraryDayDetail(
  row: any,
  presentationBlocks: QuotePresentationBlockDetail[] = []
): QuoteItineraryDayDetail {
  return {
    id: row.id,
    dayNo: row.day_no,
    serviceDate: row.service_date ?? null,
    title: row.title ?? null,
    publicDescription: row.public_description ?? null,
    internalNotes: row.internal_notes ?? null,
    routeSegments: (row.route_segments ?? []).map(mapQuoteRouteSegmentDetail),
    presentationBlocks
  };
}

function mapQuotePresentationBlockDetail(row: any): QuotePresentationBlockDetail {
  return {
    id: row.id,
    quoteItineraryDayId: row.quote_itinerary_day_id ?? null,
    sourceSupplierMediaId: row.source_supplier_media_id ?? null,
    blockType: row.block_type,
    displayContext: row.display_context,
    title: row.title ?? null,
    description: row.description ?? null,
    imageStoragePath: row.image_storage_path ?? null,
    imageUrl: row.image_url ?? null,
    altText: row.alt_text ?? null,
    sortOrder: row.sort_order,
    isPublic: Boolean(row.is_public),
    metadata: row.metadata ?? {}
  };
}

function mapQuoteRouteSegmentDetail(row: any): QuoteRouteSegmentDetail {
  return {
    id: row.id,
    seq: row.seq,
    originLabel: row.origin_label,
    destinationLabel: row.destination_label,
    travelMinutes: row.travel_minutes ?? null,
    distanceMeters: row.distance_meters ?? null,
    provider: row.provider,
    manualOverride: Boolean(row.manual_override)
  };
}

function mapQuoteItemDetail(row: any): QuoteItemDetail {
  return {
    id: row.id,
    itemCategory: row.item_category,
    snapshotItemName: row.snapshot_item_name,
    snapshotSupplierName: row.snapshot_supplier_name ?? null,
    snapshotCostCurrency: row.snapshot_cost_currency,
    snapshotUnitCostAmount: Number(row.snapshot_unit_cost_amount ?? 0),
    exchangeRateToKrw: Number(row.exchange_rate_to_krw ?? 1),
    pricingUnit: row.pricing_unit,
    quantity: Number(row.quantity ?? 0),
    paxCount: row.pax_count ?? null,
    marginMode: row.margin_mode,
    marginRate: row.margin_rate === null || row.margin_rate === undefined ? null : Number(row.margin_rate),
    manualMarginAmount:
      row.manual_margin_amount === null || row.manual_margin_amount === undefined
        ? null
        : Number(row.manual_margin_amount),
    totalCostKrw: Number(row.total_cost_krw ?? 0),
    totalSellAmount: Number(row.total_sell_amount ?? 0),
    partnerVisibleNotes: row.partner_visible_notes ?? null,
    internalNotes: row.internal_notes ?? null,
    serviceSection: row.service_section ?? "land",
    calculationMode: row.calculation_mode ?? "auto_formula",
    excelCellRef: row.excel_cell_ref ?? null,
    excelFormula: row.excel_formula ?? null,
    manualOverride: Boolean(row.manual_override),
    supplierCostBreakdown: row.supplier_cost_breakdown ?? {},
    publicBreakdown: row.public_breakdown ?? {}
  };
}

function mapQuoteRequestTimelineItem(row: any): QuoteRequestTimelineItem {
  return {
    id: row.id,
    inquiryType: row.inquiry_type,
    title: row.title,
    status: row.status,
    sourceChannel: row.source_channel,
    requestPayload: row.request_payload ?? {},
    createdAt: row.created_at
  };
}

function normalizeSearchTerm(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

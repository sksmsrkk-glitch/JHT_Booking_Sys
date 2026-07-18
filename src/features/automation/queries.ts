/**
 * @file 한글 책임: `automation` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import type { FailedAutomationJob, GmailReviewFilters, GmailReviewItem } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function listGmailReviewItems(
  supabase: SupabaseClientLike,
  filters: GmailReviewFilters = {}
): Promise<GmailReviewItem[]> {
  let query = supabase
    .from("email_threads")
    .select(
      "id, gmail_thread_id, quote_case_id, reservation_id, agency_account_id, match_confidence, requires_manual_review, created_at, quote_cases(case_code, tour_name), reservations(reservation_code), agency_accounts(name), email_messages(id, subject, from_email, received_at, created_at), gmail_match_candidates(id, quote_case_id, score, reasons, requires_manual_review, updated_at, quote_cases(case_code, tour_name), agency_accounts(name))"
    )
    .limit(150);

  if (filters.review === "manual") {
    query = query.eq("requires_manual_review", true);
  } else if (filters.review === "linked") {
    query = query.eq("requires_manual_review", false);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapGmailReviewItem);
}

export async function listFailedAutomationJobs(supabase: SupabaseClientLike): Promise<FailedAutomationJob[]> {
  const [supplierMessages, quoteExports] = await Promise.all([
    listFailedSupplierMessages(supabase),
    listFailedQuoteExports(supabase)
  ]);

  return [...supplierMessages, ...quoteExports]
    .sort((left, right) => String(right.failedAt ?? right.createdAt).localeCompare(String(left.failedAt ?? left.createdAt)))
    .slice(0, 100);
}

function mapGmailReviewItem(row: any): GmailReviewItem {
  const messages = Array.isArray(row.email_messages) ? row.email_messages : [];
  const latestMessage = [...messages].sort((left, right) =>
    String(right.received_at ?? right.created_at).localeCompare(String(left.received_at ?? left.created_at))
  )[0];

  return {
    id: row.id,
    gmailThreadId: row.gmail_thread_id,
    quoteCaseId: row.quote_case_id ?? null,
    caseCode: row.quote_cases?.case_code ?? null,
    tourName: row.quote_cases?.tour_name ?? null,
    reservationId: row.reservation_id ?? null,
    reservationCode: row.reservations?.reservation_code ?? null,
    agencyName: row.agency_accounts?.name ?? null,
    matchConfidence: row.match_confidence === null || row.match_confidence === undefined ? null : Number(row.match_confidence),
    requiresManualReview: Boolean(row.requires_manual_review),
    messageCount: messages.length,
    latestSubject: latestMessage?.subject ?? null,
    latestFromEmail: latestMessage?.from_email ?? null,
    latestReceivedAt: latestMessage?.received_at ?? latestMessage?.created_at ?? null,
    matchCandidates: (row.gmail_match_candidates ?? [])
      .map(mapGmailMatchCandidate)
      .sort((left: any, right: any) => right.score - left.score)
      .slice(0, 3),
    createdAt: row.created_at
  };
}

function mapGmailMatchCandidate(row: any) {
  return {
    id: row.id,
    quoteCaseId: row.quote_case_id,
    caseCode: row.quote_cases?.case_code ?? null,
    tourName: row.quote_cases?.tour_name ?? null,
    agencyName: row.agency_accounts?.name ?? null,
    score: Number(row.score ?? 0),
    reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
    requiresManualReview: Boolean(row.requires_manual_review),
    updatedAt: row.updated_at
  };
}

async function listFailedSupplierMessages(supabase: SupabaseClientLike): Promise<FailedAutomationJob[]> {
  const { data, error } = await supabase
    .from("supplier_message_outbox")
    .select(
      "id, reservation_id, domestic_supplier_id, message_type, channel, risk_level, status, subject, approved_at, second_approved_at, error_message, updated_at, created_at, reservations(reservation_code), domestic_suppliers(name_ko)"
    )
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFailedSupplierMessage);
}

async function listFailedQuoteExports(supabase: SupabaseClientLike): Promise<FailedAutomationJob[]> {
  const { data, error } = await supabase
    .from("quote_exports")
    .select(
      "id, quote_version_id, export_type, storage_path, status, error_message, created_at, quote_versions(id, version_no, quote_case_id, quote_cases(id, case_code, tour_name))"
    )
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFailedQuoteExport);
}

function mapFailedSupplierMessage(row: any): FailedAutomationJob {
  const reservationCode = row.reservations?.reservation_code ?? null;
  const supplierName = row.domestic_suppliers?.name_ko ?? null;
  return {
    id: `supplier_message:${row.id}`,
    kind: "supplier_message",
    title: row.subject ?? `${formatLabel(row.message_type)} to ${supplierName ?? row.domestic_supplier_id}`,
    status: "failed",
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
    failedAt: row.updated_at ?? row.created_at,
    detailHref: `/admin/supplier-messages/${row.id}`,
    retryLabel: "Requeue",
    supplierMessage: {
      id: row.id,
      messageType: row.message_type,
      status: row.status,
      channel: row.channel,
      riskLevel: row.risk_level,
      approvedAt: row.approved_at ?? null,
      secondApprovedAt: row.second_approved_at ?? null,
      reservationCode,
      supplierName
    }
  };
}

function mapFailedQuoteExport(row: any): FailedAutomationJob {
  const version = Array.isArray(row.quote_versions) ? row.quote_versions[0] : row.quote_versions;
  const quoteCase = Array.isArray(version?.quote_cases) ? version.quote_cases[0] : version?.quote_cases;
  const caseCode = quoteCase?.case_code ?? null;
  const versionNo = version?.version_no === undefined || version?.version_no === null ? null : Number(version.version_no);

  return {
    id: `quote_export:${row.id}`,
    kind: "quote_export",
    title: `${String(row.export_type ?? "xlsx").toUpperCase()} export${caseCode ? ` for ${caseCode}` : ""}`,
    status: "failed",
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
    failedAt: row.created_at,
    detailHref: quoteCase?.id ? `/admin/quote-cases/${quoteCase.id}` : "/admin/quote-cases",
    retryLabel: "Retry",
    quoteExport: {
      id: row.id,
      exportType: row.export_type,
      storagePath: row.storage_path ?? null,
      quoteVersionId: row.quote_version_id,
      quoteCaseId: quoteCase?.id ?? version?.quote_case_id ?? null,
      caseCode,
      tourName: quoteCase?.tour_name ?? null,
      versionNo
    }
  };
}

function formatLabel(value: string) {
  return String(value)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

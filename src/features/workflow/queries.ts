import type { WorkflowActionItem, WorkflowMessage, WorkflowThreadDetail, WorkflowThreadSummary } from "./types";

/*
 * workflow thread는 정호여행사 시스템의 "업무 원장"입니다.
 *
 * 하나의 workflowCode 아래에 신규 문의, 견적 변경, 예약 요청, 취소 문의,
 * 인보이스 질문, 내부 follow-up action을 모두 묶습니다. 이 코드가
 * inquiry code = quotation code = confirmation code = invoice code =
 * finance code = guide expense report no 원칙을 DB 조회 레벨에서 지켜주는 축입니다.
 */
type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function getWorkflowThreadByCode(
  supabase: SupabaseClientLike,
  workflowCode: string,
  options: { partnerVisibleOnly?: boolean } = {}
): Promise<WorkflowThreadDetail | null> {
  // 파트너 화면에서는 partner_visible 데이터만 조회해야 합니다.
  // 내부 관리자 화면은 같은 thread를 보되 internal_only 메시지와 action item까지 볼 수 있습니다.
  const { data: thread, error: threadError } = await supabase
    .from("workflow_threads")
    .select("id, workflow_code, title, status, agency_account_id, agency_inquiry_id, quote_case_id, reservation_id, current_invoice_id, last_message_at, created_at, agency_accounts(name)")
    .eq("workflow_code", workflowCode)
    .maybeSingle();

  if (threadError) throw new Error(threadError.message);
  if (!thread) return null;

  let messagesQuery = supabase
    .from("workflow_messages")
    .select("id, workflow_thread_id, sender_type, sender_profile_id, sender_agency_user_id, sender_name, sender_email, message_type, body, visibility, linked_quote_version_id, linked_invoice_id, created_at")
    .eq("workflow_thread_id", thread.id)
    .order("created_at", { ascending: true });

  if (options.partnerVisibleOnly) messagesQuery = messagesQuery.eq("visibility", "partner_visible");

  let actionsQuery = supabase
    .from("workflow_action_items")
    .select("id, workflow_thread_id, source_message_id, category, title, details, status, partner_visible, linked_quote_version_id, assigned_to, due_at, resolved_at, created_at")
    .eq("workflow_thread_id", thread.id)
    .order("created_at", { ascending: true });

  if (options.partnerVisibleOnly) actionsQuery = actionsQuery.eq("partner_visible", true);

  const [{ data: messages, error: messagesError }, { data: actionItems, error: actionsError }] = await Promise.all([
    messagesQuery,
    actionsQuery
  ]);

  if (messagesError) throw new Error(messagesError.message);
  if (actionsError) throw new Error(actionsError.message);

  return {
    ...mapWorkflowThread(thread),
    messages: (messages ?? []).map(mapWorkflowMessage),
    actionItems: (actionItems ?? []).map(mapWorkflowActionItem),
    linkedDocs: {
      inquiryId: thread.agency_inquiry_id ?? null,
      quoteCaseId: thread.quote_case_id ?? null,
      reservationId: thread.reservation_id ?? null,
      invoiceId: thread.current_invoice_id ?? null
    }
  };
}

export async function listWorkflowThreads(
  supabase: SupabaseClientLike,
  options: { agencyAccountId?: string; limit?: number } = {}
): Promise<WorkflowThreadSummary[]> {
  let query = supabase
    .from("workflow_threads")
    .select("id, workflow_code, title, status, agency_account_id, agency_inquiry_id, quote_case_id, reservation_id, current_invoice_id, last_message_at, created_at, agency_accounts(name)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.agencyAccountId) query = query.eq("agency_account_id", options.agencyAccountId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWorkflowThread);
}

export async function ensureWorkflowThread(
  supabase: SupabaseClientLike,
  input: {
    workflowCode: string;
    title: string;
    agencyAccountId?: string | null;
    agencyInquiryId?: string | null;
    quoteCaseId?: string | null;
    reservationId?: string | null;
    currentInvoiceId?: string | null;
    createdBy?: string | null;
  }
) {
  // 이미 같은 workflowCode의 원장이 있으면 새로 만들지 않습니다.
  // 같은 단체에 커뮤니케이션 원장이 여러 개 생기면 견적/예약/인보이스 추적이 깨집니다.
  const existing = await getWorkflowThreadByCode(supabase, input.workflowCode);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("workflow_threads")
    .insert({
      workflow_code: input.workflowCode,
      title: input.title,
      agency_account_id: input.agencyAccountId ?? null,
      agency_inquiry_id: input.agencyInquiryId ?? null,
      quote_case_id: input.quoteCaseId ?? null,
      reservation_id: input.reservationId ?? null,
      current_invoice_id: input.currentInvoiceId ?? null,
      status: "open",
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null
    })
    .select("id, workflow_code, title, status, agency_account_id, agency_inquiry_id, quote_case_id, reservation_id, current_invoice_id, last_message_at, created_at, agency_accounts(name)")
    .single();

  if (error) throw new Error(error.message);

  return {
    ...mapWorkflowThread(data),
    messages: [],
    actionItems: [],
    linkedDocs: {
      inquiryId: data.agency_inquiry_id ?? null,
      quoteCaseId: data.quote_case_id ?? null,
      reservationId: data.reservation_id ?? null,
      invoiceId: data.current_invoice_id ?? null
    }
  };
}

export async function resolveWorkflowSeedByCode(supabase: SupabaseClientLike, workflowCode: string) {
  const normalized = workflowCode.trim();

  // 1순위: quote_cases.case_code
  // 최초 견적 건이 만들어진 후에는 대부분의 내부 업무가 case_code를 기준으로 움직입니다.
  const { data: quoteCase } = await supabase
    .from("quote_cases")
    .select("id, case_code, tour_name, agency_account_id, agency_inquiry_id")
    .eq("case_code", normalized)
    .maybeSingle();

  if (quoteCase) {
    const { data: reservation } = await supabase
      .from("reservations")
      .select("id, reservation_code")
      .eq("quote_case_id", quoteCase.id)
      .maybeSingle();
    return {
      workflowCode: quoteCase.case_code,
      title: quoteCase.tour_name,
      agencyAccountId: quoteCase.agency_account_id,
      agencyInquiryId: quoteCase.agency_inquiry_id,
      quoteCaseId: quoteCase.id,
      reservationId: reservation?.id ?? null
    };
  }

  // 2순위: agency_inquiries.tour_code
  // 파트너가 신규 문의를 막 제출한 직후에는 아직 quote_case가 없을 수 있습니다.
  const { data: inquiry } = await supabase
    .from("agency_inquiries")
    .select("id, title, tour_code, agency_account_id, related_quote_case_id")
    .eq("tour_code", normalized)
    .maybeSingle();

  if (inquiry) {
    return {
      workflowCode: inquiry.tour_code,
      title: inquiry.title,
      agencyAccountId: inquiry.agency_account_id,
      agencyInquiryId: inquiry.id,
      quoteCaseId: inquiry.related_quote_case_id ?? null,
      reservationId: null
    };
  }

  // 3순위: reservations.reservation_code
  // 이미 확정 예약으로 넘어온 건은 reservation_code만 알고 들어오는 케이스를 지원합니다.
  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, reservation_code, agency_account_id, quote_case_id, quote_cases(case_code, tour_name, agency_inquiry_id)")
    .eq("reservation_code", normalized)
    .maybeSingle();

  if (reservation) {
    const quoteCase = Array.isArray(reservation.quote_cases) ? reservation.quote_cases[0] : reservation.quote_cases;
    return {
      workflowCode: quoteCase?.case_code ?? reservation.reservation_code,
      title: quoteCase?.tour_name ?? reservation.reservation_code,
      agencyAccountId: reservation.agency_account_id,
      agencyInquiryId: quoteCase?.agency_inquiry_id ?? null,
      quoteCaseId: reservation.quote_case_id,
      reservationId: reservation.id
    };
  }

  return null;
}

function mapWorkflowThread(row: any): WorkflowThreadSummary {
  return {
    id: row.id,
    workflowCode: row.workflow_code,
    title: row.title,
    status: row.status,
    agencyAccountId: row.agency_account_id ?? null,
    agencyName: row.agency_accounts?.name ?? null,
    agencyInquiryId: row.agency_inquiry_id ?? null,
    quoteCaseId: row.quote_case_id ?? null,
    reservationId: row.reservation_id ?? null,
    currentInvoiceId: row.current_invoice_id ?? null,
    lastMessageAt: row.last_message_at ?? null,
    createdAt: row.created_at
  };
}

function mapWorkflowMessage(row: any): WorkflowMessage {
  return {
    id: row.id,
    threadId: row.workflow_thread_id,
    senderType: row.sender_type,
    senderProfileId: row.sender_profile_id ?? null,
    senderAgencyUserId: row.sender_agency_user_id ?? null,
    senderName: row.sender_name ?? null,
    senderEmail: row.sender_email ?? null,
    messageType: row.message_type,
    body: row.body,
    visibility: row.visibility,
    linkedQuoteVersionId: row.linked_quote_version_id ?? null,
    linkedInvoiceId: row.linked_invoice_id ?? null,
    createdAt: row.created_at
  };
}

function mapWorkflowActionItem(row: any): WorkflowActionItem {
  return {
    id: row.id,
    threadId: row.workflow_thread_id,
    sourceMessageId: row.source_message_id ?? null,
    category: row.category,
    title: row.title,
    details: row.details ?? null,
    status: row.status,
    partnerVisible: Boolean(row.partner_visible),
    linkedQuoteVersionId: row.linked_quote_version_id ?? null,
    assignedTo: row.assigned_to ?? null,
    dueAt: row.due_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at
  };
}

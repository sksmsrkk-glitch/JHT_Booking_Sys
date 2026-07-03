import type {
  SupplierMessageDetail,
  SupplierMessageEventItem,
  SupplierMessageFilters,
  SupplierMessageListItem
} from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const SUPPLIER_MESSAGE_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "queued",
  "sending",
  "sent",
  "failed",
  "cancelled"
];

// 공급자 아웃박스 발신 채널은 도메인 검증기(buildSupplierMessageDraft)와 일치해야 합니다.
// "internal"은 도메인에서 허용되지 않으므로 여기서도 제외합니다(선택 시 500 방지).
export const SUPPLIER_MESSAGE_CHANNELS = ["email", "kakao_alimtalk", "kakao_friendtalk"];

export const SUPPLIER_MESSAGE_TYPES = [
  "booking_request",
  "confirmation_request",
  "change_request",
  "cancellation_request",
  "final_confirmation",
  "pre_event_reminder"
];

export async function listSupplierMessages(
  supabase: SupabaseClientLike,
  filters: SupplierMessageFilters = {}
): Promise<SupplierMessageListItem[]> {
  const status = normalizeEnum(filters.status, SUPPLIER_MESSAGE_STATUSES);
  const channel = normalizeEnum(filters.channel, SUPPLIER_MESSAGE_CHANNELS);
  const messageType = normalizeEnum(filters.messageType, SUPPLIER_MESSAGE_TYPES);

  let query = supabase
    .from("supplier_message_outbox")
    .select(
      "id, reservation_id, domestic_supplier_id, supplier_contact_id, message_type, channel, risk_level, status, subject, approved_at, second_approved_at, sent_at, error_message, idempotency_key, created_at, reservations(reservation_code), domestic_suppliers(name_ko), supplier_contacts(name), supplier_message_events(id)"
    )
    .limit(150);

  if (status) query = query.eq("status", status);
  if (channel) query = query.eq("channel", channel);
  if (messageType) query = query.eq("message_type", messageType);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapSupplierMessageListItem);
}

export async function getSupplierMessageDetail(
  supabase: SupabaseClientLike,
  messageId: string
): Promise<SupplierMessageDetail | null> {
  const { data: message, error: messageError } = await supabase
    .from("supplier_message_outbox")
    .select(
      "id, reservation_id, domestic_supplier_id, supplier_contact_id, template_id, message_type, channel, risk_level, status, subject, body, approved_by, approved_at, second_approved_by, second_approved_at, sent_at, provider_message_id, error_message, metadata, idempotency_key, created_at, reservations(reservation_code), domestic_suppliers(name_ko), supplier_contacts(name)"
    )
    .eq("id", messageId)
    .maybeSingle();

  if (messageError) throw new Error(messageError.message);
  if (!message) return null;

  const { data: events, error: eventError } = await supabase
    .from("supplier_message_events")
    .select("id, event_type, provider, provider_payload, created_at")
    .eq("supplier_message_outbox_id", messageId)
    .order("created_at", { ascending: false });

  if (eventError) throw new Error(eventError.message);

  return {
    ...mapSupplierMessageListItem({
      ...message,
      supplier_message_events: events ?? []
    }),
    body: message.body,
    templateId: message.template_id ?? null,
    providerMessageId: message.provider_message_id ?? null,
    metadata: safeRecord(message.metadata),
    approvedBy: message.approved_by ?? null,
    secondApprovedBy: message.second_approved_by ?? null,
    sentAt: message.sent_at ?? null,
    events: (events ?? []).map(mapSupplierMessageEventItem)
  };
}

function mapSupplierMessageListItem(row: any): SupplierMessageListItem {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationCode: row.reservations?.reservation_code ?? null,
    domesticSupplierId: row.domestic_supplier_id,
    domesticSupplierName: row.domestic_suppliers?.name_ko ?? null,
    supplierContactName: row.supplier_contacts?.name ?? null,
    messageType: row.message_type,
    channel: row.channel,
    riskLevel: row.risk_level,
    status: row.status,
    subject: row.subject ?? null,
    approvedAt: row.approved_at ?? null,
    secondApprovedAt: row.second_approved_at ?? null,
    sentAt: row.sent_at ?? null,
    errorMessage: row.error_message ?? null,
    idempotencyKey: row.idempotency_key,
    eventCount: Array.isArray(row.supplier_message_events) ? row.supplier_message_events.length : 0,
    createdAt: row.created_at
  };
}

function mapSupplierMessageEventItem(row: any): SupplierMessageEventItem {
  return {
    id: row.id,
    eventType: row.event_type,
    provider: row.provider ?? null,
    providerPayload: safeRecord(row.provider_payload),
    createdAt: row.created_at
  };
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

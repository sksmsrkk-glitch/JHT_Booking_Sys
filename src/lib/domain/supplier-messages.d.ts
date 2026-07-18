/**
 * @file 한글 책임: `supplier messages` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
export const SUPPLIER_MESSAGE_TYPES: string[];
export const SUPPLIER_MESSAGE_CHANNELS: string[];
export const SUPPLIER_PROVIDER_EVENT_TYPES: string[];
export const DEFAULT_SUPPLIER_MESSAGE_TEMPLATES: Record<string, { subject: string; body: string }>;

export function renderSupplierTemplate(template: string, data: Record<string, unknown>): string;
export function buildSupplierMessageDraft(input: {
  reservationId: string;
  domesticSupplierId: string;
  supplierContactId?: string | null;
  messageType: string;
  channel: string;
  subjectTemplate?: string | null;
  bodyTemplate?: string | null;
  data?: Record<string, unknown>;
  revisionNo?: number;
}): {
  reservation_id: string;
  domestic_supplier_id: string;
  supplier_contact_id: string | null;
  message_type: string;
  channel: string;
  subject: string;
  body: string;
  status: "draft";
  risk_level: string;
  idempotency_key: string;
};
export function assertSupplierMessageDraftAllowed(input: { reservationStatus?: string | null }): true;
export function resolveRiskLevel(messageType: string): string;
export function buildDefaultSupplierMessageTemplate(input: {
  messageType: string;
  data?: Record<string, unknown>;
}): {
  subjectTemplate: string;
  bodyTemplate: string;
  subject: string;
  body: string;
};
export function normalizeSupplierMessageTemplateData(data?: Record<string, unknown>): Record<string, unknown>;
export function buildSupplierMessageIdempotencyKey(input: {
  reservationId: string;
  domesticSupplierId: string;
  messageType: string;
  channel: string;
  revisionNo?: number;
}): string;
export function assertSupplierMessageCanSend(message: {
  approved_by?: string | null;
  approved_at?: string | null;
  second_approved_by?: string | null;
  message_type?: string | null;
}): true;
export function buildSupplierMessageRequeueUpdate(message: {
  id?: string | null;
  status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  second_approved_by?: string | null;
  message_type?: string | null;
}): {
  status: "queued";
  error_message: null;
};
export function buildSupplierProviderCallbackUpdate(input: {
  eventType: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  occurredAt?: string | null;
}): Record<string, unknown>;
export function buildSupplierMessageDeliveryAttempt(input: {
  message: {
    id: string;
    status: string;
    channel: string;
    message_type: string;
    supplier_contact_id?: string | null;
    subject?: string | null;
    idempotency_key?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    second_approved_by?: string | null;
  };
  env?: Record<string, string | undefined>;
  now?: Date | string;
}): {
  provider: string;
  dryRun: boolean;
  providerMessageId: string;
  sendingUpdate: Record<string, unknown>;
  finalUpdate: Record<string, unknown>;
  sendingEvent: Record<string, unknown>;
  finalEvent: Record<string, unknown>;
};

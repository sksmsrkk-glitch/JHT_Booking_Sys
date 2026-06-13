export const SUPPLIER_MESSAGE_TYPES = [
  "booking_request",
  "confirmation_request",
  "change_request",
  "cancellation_request",
  "final_confirmation",
  "pre_event_reminder"
];

export const SUPPLIER_MESSAGE_CHANNELS = ["email", "kakao_alimtalk", "kakao_friendtalk"];

export function renderSupplierTemplate(template, data) {
  return String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = key.split(".").reduce((current, part) => {
      if (current && typeof current === "object") return current[part];
      return undefined;
    }, data);
    return value === undefined || value === null ? "" : String(value);
  });
}

export function buildSupplierMessageDraft(input) {
  if (!SUPPLIER_MESSAGE_TYPES.includes(input.messageType)) {
    throw new Error(`Unsupported supplier message type: ${input.messageType}`);
  }

  if (!SUPPLIER_MESSAGE_CHANNELS.includes(input.channel)) {
    throw new Error(`Unsupported supplier message channel: ${input.channel}`);
  }

  return {
    reservation_id: input.reservationId,
    domestic_supplier_id: input.domesticSupplierId,
    supplier_contact_id: input.supplierContactId ?? null,
    message_type: input.messageType,
    channel: input.channel,
    subject: renderSupplierTemplate(input.subjectTemplate ?? "", input.data ?? {}),
    body: renderSupplierTemplate(input.bodyTemplate ?? "", input.data ?? {}),
    status: "draft",
    risk_level: resolveRiskLevel(input.messageType),
    idempotency_key: buildSupplierMessageIdempotencyKey(input)
  };
}

export function resolveRiskLevel(messageType) {
  return ["change_request", "cancellation_request", "final_confirmation"].includes(messageType)
    ? "high"
    : "normal";
}

export function buildSupplierMessageIdempotencyKey(input) {
  return [
    input.reservationId,
    input.domesticSupplierId,
    input.messageType,
    input.channel,
    input.revisionNo ?? 1
  ].join(":");
}

export function assertSupplierMessageCanSend(message) {
  if (!message.approved_by || !message.approved_at) {
    throw new Error("Supplier message must be approved before send");
  }

  if (message.message_type === "cancellation_request" && !message.second_approved_by) {
    throw new Error("Cancellation message requires second approval");
  }

  return true;
}

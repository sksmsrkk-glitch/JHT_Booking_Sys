export const SUPPLIER_MESSAGE_TYPES = [
  "booking_request",
  "confirmation_request",
  "change_request",
  "cancellation_request",
  "final_confirmation",
  "pre_event_reminder"
];

export const SUPPLIER_MESSAGE_CHANNELS = ["email", "kakao_alimtalk", "kakao_friendtalk"];

export const SUPPLIER_PROVIDER_EVENT_TYPES = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "opened",
  "clicked"
];

export const DEFAULT_SUPPLIER_MESSAGE_TEMPLATES = {
  booking_request: {
    subject: "[{{reservation.code}}] Booking request - {{reservation.tourName}}",
    body:
      "Dear {{supplier.name}},\n\nPlease review the booking request below.\n\nReservation: {{reservation.code}}\nTour: {{reservation.tourName}}\nDates: {{reservation.dateRange}}\nAgency: {{agency.name}}\n\nRequested service: {{message.serviceSummary}}\n\nPlease confirm availability, net rate, cancellation policy, and any special conditions.\n\nBest regards,\nJungho Travel"
  },
  confirmation_request: {
    subject: "[{{reservation.code}}] Confirmation request - {{reservation.tourName}}",
    body:
      "Dear {{supplier.name}},\n\nPlease confirm the current booking details for the reservation below.\n\nReservation: {{reservation.code}}\nTour: {{reservation.tourName}}\nDates: {{reservation.dateRange}}\n\nPlease reply with the confirmation number, final inclusions, and contact person on duty.\n\nBest regards,\nJungho Travel"
  },
  change_request: {
    subject: "[{{reservation.code}}] Change request - {{reservation.tourName}}",
    body:
      "Dear {{supplier.name}},\n\nWe need to request a change for the following reservation.\n\nReservation: {{reservation.code}}\nTour: {{reservation.tourName}}\nDates: {{reservation.dateRange}}\n\nChange details:\n{{message.changeSummary}}\n\nPlease confirm whether this change is possible and advise any cost or policy impact.\n\nBest regards,\nJungho Travel"
  },
  cancellation_request: {
    subject: "[{{reservation.code}}] Cancellation request - {{reservation.tourName}}",
    body:
      "Dear {{supplier.name}},\n\nPlease cancel the booking related to the reservation below.\n\nReservation: {{reservation.code}}\nTour: {{reservation.tourName}}\nDates: {{reservation.dateRange}}\n\nPlease confirm cancellation completion and advise any cancellation fee.\n\nBest regards,\nJungho Travel"
  },
  final_confirmation: {
    subject: "[{{reservation.code}}] Final confirmation - {{reservation.tourName}}",
    body:
      "Dear {{supplier.name}},\n\nThis is the final confirmation request before the event.\n\nReservation: {{reservation.code}}\nTour: {{reservation.tourName}}\nDates: {{reservation.dateRange}}\n\nPlease reconfirm service time, location, inclusions, emergency contact, and payment/settlement notes.\n\nBest regards,\nJungho Travel"
  },
  pre_event_reminder: {
    subject: "[{{reservation.code}}] Pre-event reminder - {{reservation.tourName}}",
    body:
      "Dear {{supplier.name}},\n\nThis is a pre-event reminder for the upcoming service.\n\nReservation: {{reservation.code}}\nTour: {{reservation.tourName}}\nDates: {{reservation.dateRange}}\n\nPlease ensure the service team has the latest operational details.\n\nBest regards,\nJungho Travel"
  }
};

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

export function assertSupplierMessageDraftAllowed({ reservationStatus }) {
  if (["cancelled", "completed"].includes(reservationStatus)) {
    throw new Error(`Supplier message drafts are locked when reservation status is ${reservationStatus}`);
  }
  return true;
}

export function resolveRiskLevel(messageType) {
  return ["change_request", "cancellation_request", "final_confirmation"].includes(messageType)
    ? "high"
    : "normal";
}

export function buildDefaultSupplierMessageTemplate({ messageType, data = {} }) {
  const template = DEFAULT_SUPPLIER_MESSAGE_TEMPLATES[messageType];
  if (!template) {
    throw new Error(`Unsupported supplier message type: ${messageType}`);
  }

  const normalizedData = normalizeSupplierMessageTemplateData(data);
  return {
    subjectTemplate: template.subject,
    bodyTemplate: template.body,
    subject: renderSupplierTemplate(template.subject, normalizedData),
    body: renderSupplierTemplate(template.body, normalizedData)
  };
}

export function normalizeSupplierMessageTemplateData(data = {}) {
  const reservation = data.reservation ?? {};
  const supplier = data.supplier ?? {};
  const agency = data.agency ?? {};
  const message = data.message ?? {};

  return {
    reservation: {
      code: reservation.code ?? "Reservation",
      tourName: reservation.tourName ?? "Tour name not set",
      dateRange: reservation.dateRange ?? formatDateRange(reservation.startDate, reservation.endDate)
    },
    supplier: {
      name: supplier.name ?? "Supplier"
    },
    agency: {
      name: agency.name ?? "Agency"
    },
    message: {
      serviceSummary: message.serviceSummary ?? "Please describe requested service details.",
      changeSummary: message.changeSummary ?? "Please describe requested changes."
    }
  };
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

export function buildSupplierMessageRequeueUpdate(message) {
  if (!message?.id) {
    throw new Error("message.id is required");
  }
  if (message.status !== "failed") {
    throw new Error(`Only failed supplier messages can be requeued, got ${message.status}`);
  }
  assertSupplierMessageCanSend(message);

  return {
    status: "queued",
    error_message: null
  };
}

export function buildSupplierProviderCallbackUpdate({ eventType, providerMessageId, errorMessage, occurredAt }) {
  if (!SUPPLIER_PROVIDER_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Unsupported supplier provider event type: ${eventType}`);
  }

  const update = {};
  const timestamp = normalizeOptionalTimestamp(occurredAt) ?? new Date().toISOString();

  if (eventType === "sending") {
    update.status = "sending";
  }

  if (eventType === "sent" || eventType === "delivered") {
    update.status = "sent";
    update.sent_at = timestamp;
    update.error_message = null;
  }

  if (eventType === "failed" || eventType === "bounced") {
    update.status = "failed";
    update.error_message = normalizeOptionalText(errorMessage) ?? eventType;
  }

  const normalizedProviderMessageId = normalizeOptionalText(providerMessageId);
  if (normalizedProviderMessageId) {
    update.provider_message_id = normalizedProviderMessageId;
  }

  return update;
}

export function buildSupplierMessageDeliveryAttempt({ message, env = {}, now = new Date() }) {
  if (!message?.id) {
    throw new Error("message.id is required");
  }
  if (message.status !== "queued") {
    throw new Error(`Supplier message delivery requires queued status, got ${message.status}`);
  }
  assertSupplierMessageCanSend(message);

  const dryRun = env.SUPPLIER_MESSAGE_DELIVERY_MODE !== "live";
  const provider = resolveSupplierMessageProvider({ channel: message.channel, env, dryRun });
  const timestamp = normalizeDate(now);
  const providerMessageId = [
    provider,
    message.idempotency_key || message.id
  ].join(":");

  return {
    provider,
    dryRun,
    providerMessageId,
    sendingUpdate: {
      status: "sending",
      error_message: null
    },
    finalUpdate: {
      status: dryRun ? "simulated" : "sent",
      provider_message_id: providerMessageId,
      sent_at: dryRun ? null : timestamp,
      error_message: null
    },
    sendingEvent: {
      event_type: "sending",
      provider,
      provider_payload: {
        dryRun,
        channel: message.channel,
        providerMessageId
      }
    },
    finalEvent: {
      event_type: dryRun ? "simulated" : "submitted",
      provider,
      provider_payload: {
        dryRun,
        channel: message.channel,
        providerMessageId,
        recipientContactId: message.supplier_contact_id ?? null,
        subject: message.subject ?? null
      }
    }
  };
}

function resolveSupplierMessageProvider({ channel, env, dryRun }) {
  if (channel === "email") {
    const provider = normalizeOptionalText(env.EMAIL_PROVIDER_NAME) ?? normalizeOptionalText(env.EMAIL_PROVIDER);
    if (provider) return provider;
    if (dryRun) return "email_dry_run";
    throw new Error("EMAIL_PROVIDER_NAME is required for live email delivery");
  }

  if (channel === "kakao_alimtalk" || channel === "kakao_friendtalk") {
    const provider = normalizeOptionalText(env.KAKAO_BIZ_PROVIDER);
    const apiKey = normalizeOptionalText(env.KAKAO_BIZ_API_KEY);
    if (provider && apiKey) return provider;
    if (dryRun) return "kakao_dry_run";
    throw new Error("KAKAO_BIZ_PROVIDER and KAKAO_BIZ_API_KEY are required for live Kakao delivery");
  }

  throw new Error(`Unsupported supplier message channel: ${channel}`);
}

function formatDateRange(startDate, endDate) {
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return "Dates not set";
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalTimestamp(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("occurredAt must be a valid date/time");
  }
  return parsed.toISOString();
}

function normalizeDate(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("now must be a valid date");
  }
  return parsed.toISOString();
}

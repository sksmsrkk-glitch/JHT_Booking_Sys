export type SupplierMessageListItem = {
  id: string;
  reservationId: string;
  reservationCode: string | null;
  domesticSupplierId: string;
  domesticSupplierName: string | null;
  supplierContactName: string | null;
  messageType: string;
  channel: string;
  riskLevel: string;
  status: string;
  subject: string | null;
  approvedAt: string | null;
  secondApprovedAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  eventCount: number;
  createdAt: string;
};

export type SupplierMessageDetail = SupplierMessageListItem & {
  body: string;
  templateId: string | null;
  providerMessageId: string | null;
  metadata: Record<string, unknown>;
  approvedBy: string | null;
  secondApprovedBy: string | null;
  sentAt: string | null;
  events: SupplierMessageEventItem[];
};

export type SupplierMessageEventItem = {
  id: string;
  eventType: string;
  provider: string | null;
  providerPayload: Record<string, unknown>;
  createdAt: string;
};

export type SupplierMessageFilters = {
  status?: string;
  channel?: string;
  messageType?: string;
};

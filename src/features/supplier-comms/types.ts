/**
 * @file 한글 책임: `supplier-comms` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
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

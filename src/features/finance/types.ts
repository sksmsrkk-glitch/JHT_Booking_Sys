/**
 * @file 한글 책임: `finance` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type InvoiceListItem = {
  id: string;
  reservationId: string;
  reservationCode: string | null;
  agencyName: string | null;
  tourName: string | null;
  invoiceNo: string;
  tourCode: string | null;
  versionNo: number;
  status: string;
  currency: string;
  totalAmount: number;
  issuedAt: string | null;
  dueDate: string | null;
  paymentDeadline: string | null;
  collectionTiming: string | null;
  collectionStatus: string;
  depositRequired: boolean;
  depositAmount: number | null;
  storagePath: string | null;
  paymentCount: number;
  confirmedPaymentTotal: number;
  expenseCount: number;
  settlementStatus: string | null;
  finalProfitAmount: number | null;
  createdAt: string;
};

export type InvoiceDetail = InvoiceListItem & {
  payments: PaymentListItem[];
  lineItems: InvoiceLineItem[];
  bankAccountSnapshot: Record<string, unknown>;
  flightDetails: Record<string, unknown>[];
  itinerarySnapshot: Record<string, unknown>[];
  invoicePayload: Record<string, unknown>;
};

export type InvoiceLineItem = {
  id: string;
  lineNo: number;
  description: string;
  serviceDate: string | null;
  category: string | null;
  currency: string;
  unitAmount: number;
  quantity: number;
  unitLabel: string | null;
  totalAmount: number;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type PaymentListItem = {
  id: string;
  status: string;
  currency: string;
  amount: number;
  receivedAt: string | null;
  method: string | null;
  referenceNo: string | null;
  idempotencyKey: string | null;
  createdAt: string;
};

export type SettlementListItem = {
  id: string;
  reservationId: string;
  reservationCode: string | null;
  agencyName: string | null;
  tourName: string | null;
  status: string;
  totalInvoiceAmount: number;
  totalPaymentAmount: number;
  totalExpenseAmount: number;
  totalExtraRevenueAmount: number;
  totalShoppingCommissionAmount: number;
  finalProfitAmount: number;
  approvedAt: string | null;
  createdAt: string;
};

export type InvoiceFilters = {
  status?: string;
  q?: string;
};

export type SettlementFilters = {
  status?: string;
  q?: string;
};

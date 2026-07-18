/**
 * @file 한글 책임: `finance` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
export type InvoicePaymentSummaryInput = {
  totalAmount: number;
  payments?: Array<{
    status: string;
    amount: number;
  }>;
};

export type InvoicePaymentSummary = {
  totalAmount: number;
  confirmedPaymentTotal: number;
  pendingPaymentTotal: number;
  remainingAmount: number;
  isPaid: boolean;
};

export function summarizeInvoicePayments(input: InvoicePaymentSummaryInput): InvoicePaymentSummary;

export type SettlementStatus = "draft" | "review" | "approved" | "closed";

export type SettlementStatusUpdateInput = {
  currentStatus: SettlementStatus;
  nextStatus: SettlementStatus;
  actorProfileId: string;
};

export type SettlementStatusUpdate = {
  status: SettlementStatus;
  approved_by?: string;
  approved_at?: string;
};

export const SETTLEMENT_STATUSES: SettlementStatus[];
export function buildSettlementStatusUpdate(
  input: SettlementStatusUpdateInput,
  now?: Date
): SettlementStatusUpdate;
export function assertFinanceAdjustmentAllowed(input: {
  settlementStatus?: SettlementStatus | null;
}): true;
export function assertFinanceEntryAllowed(input: {
  settlementStatus?: SettlementStatus | null;
}): true;

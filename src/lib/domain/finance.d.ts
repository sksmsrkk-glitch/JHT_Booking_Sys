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

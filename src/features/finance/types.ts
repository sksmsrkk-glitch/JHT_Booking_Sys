export type InvoiceListItem = {
  id: string;
  reservationId: string;
  reservationCode: string | null;
  agencyName: string | null;
  tourName: string | null;
  invoiceNo: string;
  status: string;
  currency: string;
  totalAmount: number;
  issuedAt: string | null;
  dueDate: string | null;
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

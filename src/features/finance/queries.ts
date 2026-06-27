import type {
  InvoiceDetail,
  InvoiceFilters,
  InvoiceListItem,
  PaymentListItem,
  SettlementFilters,
  SettlementListItem
} from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const INVOICE_STATUSES = ["draft", "issued", "partially_paid", "paid", "void", "overdue"];
export const SETTLEMENT_STATUSES = ["draft", "review", "approved", "closed"];

export async function listInvoices(
  supabase: SupabaseClientLike,
  filters: InvoiceFilters = {}
): Promise<InvoiceListItem[]> {
  const status = normalizeEnum(filters.status, INVOICE_STATUSES);
  const q = normalizeSearchTerm(filters.q);

  let query = supabase
    .from("invoices")
    .select(
      "id, reservation_id, invoice_no, status, currency, total_amount, issued_at, due_date, storage_path, created_at, reservations(reservation_code, quote_cases(tour_name), agency_accounts(name), expenses(id), settlements(status, final_profit_amount)), payments(id, status, amount)"
    )
    .limit(150);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`invoice_no.ilike.%${q}%`);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapInvoiceListItem);
}

export async function getInvoiceDetail(
  supabase: SupabaseClientLike,
  invoiceId: string
): Promise<InvoiceDetail | null> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, reservation_id, invoice_no, status, currency, total_amount, issued_at, due_date, storage_path, created_at, reservations(reservation_code, quote_cases(tour_name), agency_accounts(name), expenses(id), settlements(status, final_profit_amount)), payments(id, status, currency, amount, received_at, method, reference_no, idempotency_key, created_at)"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return null;

  return {
    ...mapInvoiceListItem(invoice),
    payments: (invoice.payments ?? []).map(mapPaymentListItem)
  };
}

export async function listSettlements(
  supabase: SupabaseClientLike,
  filters: SettlementFilters = {}
): Promise<SettlementListItem[]> {
  const status = normalizeEnum(filters.status, SETTLEMENT_STATUSES);
  const q = normalizeSearchTerm(filters.q);

  let query = supabase
    .from("settlements")
    .select(
      "id, reservation_id, status, total_invoice_amount, total_payment_amount, total_expense_amount, total_extra_revenue_amount, total_shopping_commission_amount, final_profit_amount, approved_at, created_at, reservations(reservation_code, quote_cases(tour_name), agency_accounts(name))"
    )
    .limit(150);

  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map(mapSettlementListItem);
  if (!q) return rows;
  return rows.filter((row: SettlementListItem) =>
    [row.reservationCode, row.agencyName, row.tourName].some((value) => value?.toLowerCase().includes(q.toLowerCase()))
  );
}

function mapInvoiceListItem(row: any): InvoiceListItem {
  const payments = Array.isArray(row.payments) ? row.payments : [];
  const confirmedPaymentTotal = payments
    .filter((payment: any) => payment.status === "confirmed")
    .reduce((total: number, payment: any) => total + Number(payment.amount ?? 0), 0);

  const settlement = Array.isArray(row.reservations?.settlements)
    ? row.reservations.settlements[0]
    : row.reservations?.settlements;

  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationCode: row.reservations?.reservation_code ?? null,
    agencyName: row.reservations?.agency_accounts?.name ?? null,
    tourName: row.reservations?.quote_cases?.tour_name ?? null,
    invoiceNo: row.invoice_no,
    status: row.status,
    currency: row.currency,
    totalAmount: Number(row.total_amount),
    issuedAt: row.issued_at ?? null,
    dueDate: row.due_date ?? null,
    storagePath: row.storage_path ?? null,
    paymentCount: payments.length,
    confirmedPaymentTotal,
    expenseCount: Array.isArray(row.reservations?.expenses) ? row.reservations.expenses.length : 0,
    settlementStatus: settlement?.status ?? null,
    finalProfitAmount:
      settlement?.final_profit_amount === null || settlement?.final_profit_amount === undefined
        ? null
        : Number(settlement.final_profit_amount),
    createdAt: row.created_at
  };
}

function mapSettlementListItem(row: any): SettlementListItem {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationCode: row.reservations?.reservation_code ?? null,
    agencyName: row.reservations?.agency_accounts?.name ?? null,
    tourName: row.reservations?.quote_cases?.tour_name ?? null,
    status: row.status,
    totalInvoiceAmount: Number(row.total_invoice_amount ?? 0),
    totalPaymentAmount: Number(row.total_payment_amount ?? 0),
    totalExpenseAmount: Number(row.total_expense_amount ?? 0),
    totalExtraRevenueAmount: Number(row.total_extra_revenue_amount ?? 0),
    totalShoppingCommissionAmount: Number(row.total_shopping_commission_amount ?? 0),
    finalProfitAmount: Number(row.final_profit_amount ?? 0),
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at
  };
}

function mapPaymentListItem(row: any): PaymentListItem {
  return {
    id: row.id,
    status: row.status,
    currency: row.currency,
    amount: Number(row.amount ?? 0),
    receivedAt: row.received_at ?? null,
    method: row.method ?? null,
    referenceNo: row.reference_no ?? null,
    idempotencyKey: row.idempotency_key ?? null,
    createdAt: row.created_at
  };
}

function normalizeSearchTerm(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString } from "@/lib/api/http";
import { assertFinanceEntryAllowed } from "@/lib/domain/finance.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const PAYMENT_STATUSES = ["pending", "confirmed", "failed", "refunded"];

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new HttpError(400, "amount must be a non-negative number");
    }

    const status = typeof body.status === "string" && PAYMENT_STATUSES.includes(body.status) ? body.status : "confirmed";
    const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : "KRW";
    const referenceNo = typeof body.referenceNo === "string" && body.referenceNo.trim() ? body.referenceNo.trim() : null;
    const method = typeof body.method === "string" && body.method.trim() ? body.method.trim() : null;
    const receivedAt =
      typeof body.receivedAt === "string" && body.receivedAt.trim() ? body.receivedAt.trim() : new Date().toISOString();
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `${id}:${status}:${amount}:${referenceNo ?? receivedAt}`;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, reservation_id, status, currency, total_amount")
      .eq("id", id)
      .single();

    if (invoiceError) throw new HttpError(500, invoiceError.message);
    await assertInvoiceFinanceOpen(supabase, invoice.reservation_id);

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .upsert(
        {
          invoice_id: id,
          status,
          currency,
          amount,
          received_at: receivedAt,
          method,
          reference_no: referenceNo ?? requireString(body.referenceNo ?? idempotencyKey, "referenceNo"),
          idempotency_key: idempotencyKey,
          created_by: financeUser.profileId
        },
        { onConflict: "idempotency_key" }
      )
      .select("id, invoice_id, status, currency, amount, received_at, method, reference_no, idempotency_key, created_at")
      .single();

    if (paymentError) throw new HttpError(500, paymentError.message);

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("status, amount")
      .eq("invoice_id", id);

    if (paymentsError) throw new HttpError(500, paymentsError.message);

    const confirmedTotal = (payments ?? [])
      .filter((row: { status: string }) => row.status === "confirmed")
      .reduce((sum: number, row: { amount: number | string }) => sum + Number(row.amount ?? 0), 0);
    const invoiceTotal = Number(invoice.total_amount ?? 0);
    const nextInvoiceStatus =
      confirmedTotal >= invoiceTotal && invoiceTotal > 0
        ? "paid"
        : confirmedTotal > 0
          ? "partially_paid"
          : invoice.status;

    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update({ status: nextInvoiceStatus })
      .eq("id", id)
      .select("id, status, total_amount")
      .single();

    if (updateError) throw new HttpError(500, updateError.message);

    await writeAuditLog(supabase, {
      actorProfileId: financeUser.profileId,
      action: "payment.recorded",
      entityTable: "payments",
      entityId: payment.id,
      riskLevel: "high",
      beforeData: invoice,
      afterData: { payment, invoice: updatedInvoice, confirmedTotal },
      approvalData: { idempotencyKey }
    });

    return created({ payment, invoice: updatedInvoice, confirmedTotal });
  } catch (error) {
    return fail(error);
  }
}

async function assertInvoiceFinanceOpen(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from("settlements")
    .select("status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  try {
    assertFinanceEntryAllowed({ settlementStatus: data?.status ?? null });
  } catch (assertionError) {
    throw new HttpError(409, assertionError instanceof Error ? assertionError.message : "Settlement is locked");
  }
}

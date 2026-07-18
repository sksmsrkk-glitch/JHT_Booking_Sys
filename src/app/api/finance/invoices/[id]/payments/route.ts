import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson } from "@/lib/api/http";
import { assertFinanceEntryAllowed } from "@/lib/domain/finance.mjs";
import { resolveInvoicePaymentState, validatePaymentInput } from "@/lib/domain/payments.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, reservation_id, status, currency, total_amount")
      .eq("id", id)
      .single();

    if (invoiceError) throw new HttpError(500, invoiceError.message);
    await assertInvoiceFinanceOpen(supabase, invoice.reservation_id);

    // 멱등키 필수 + 통화 일치 + 양수 금액을 도메인에서 검증합니다.
    let input;
    try {
      input = validatePaymentInput({
        invoiceCurrency: invoice.currency,
        amount: body.amount,
        status: body.status,
        currency: body.currency,
        idempotencyKey: body.idempotencyKey,
        referenceNo: body.referenceNo
      });
    } catch (validationError) {
      throw new HttpError(400, validationError instanceof Error ? validationError.message : "Invalid payment input");
    }

    const method = typeof body.method === "string" && body.method.trim() ? body.method.trim() : null;
    const receivedAt =
      typeof body.receivedAt === "string" && body.receivedAt.trim() ? body.receivedAt.trim() : new Date().toISOString();

    // 멱등키 재사용은 덮어쓰기가 아니라 replay로 처리합니다: 기존 결제를 그대로 돌려줍니다.
    const { data: existingPayment, error: existingError } = await supabase
      .from("payments")
      .select("id, invoice_id, status, currency, amount, received_at, method, reference_no, idempotency_key, created_at")
      .eq("invoice_id", id)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existingPayment) {
      return ok({ payment: existingPayment, replayed: true });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id: id,
        status: input.status,
        currency: input.currency,
        amount: input.amount,
        received_at: receivedAt,
        method,
        reference_no: input.referenceNo,
        idempotency_key: input.idempotencyKey,
        created_by: financeUser.profileId
      })
      .select("id, invoice_id, status, currency, amount, received_at, method, reference_no, idempotency_key, created_at")
      .single();

    if (paymentError) {
      // 동시 요청이 같은 멱등키로 먼저 insert한 경우(23505) replay로 안전 처리합니다.
      if (paymentError.code === "23505") {
        const { data: raced } = await supabase
          .from("payments")
          .select("id, invoice_id, status, currency, amount, received_at, method, reference_no, idempotency_key, created_at")
          .eq("invoice_id", id)
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        if (raced) return ok({ payment: raced, replayed: true });
      }
      throw new HttpError(500, paymentError.message);
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("status, amount")
      .eq("invoice_id", id);

    if (paymentsError) throw new HttpError(500, paymentsError.message);

    const { confirmedTotal, nextStatus, isOverpaid } = resolveInvoicePaymentState({
      invoiceTotal: invoice.total_amount,
      currentStatus: invoice.status,
      payments: payments ?? []
    });
    const nextInvoiceStatus = nextStatus;

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
      afterData: { payment, invoice: updatedInvoice, confirmedTotal, isOverpaid },
      approvalData: { idempotencyKey: input.idempotencyKey }
    });

    return created({ payment, invoice: updatedInvoice, confirmedTotal, isOverpaid });
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

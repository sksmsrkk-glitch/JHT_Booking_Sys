import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const reservationId = requireUuid(body.reservationId, "reservationId");
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);

    const [invoiceResult, paymentResult, expenseResult, revenueResult, commissionResult] = await Promise.all([
      supabase.from("invoices").select("id, total_amount").eq("reservation_id", reservationId),
      supabase
        .from("payments")
        .select("amount, invoices!inner(reservation_id)")
        .eq("status", "confirmed")
        .eq("invoices.reservation_id", reservationId),
      supabase.from("expenses").select("amount").eq("reservation_id", reservationId),
      supabase.from("extra_revenues").select("amount").eq("reservation_id", reservationId),
      supabase.from("shopping_commissions").select("commission_amount").eq("reservation_id", reservationId)
    ]);

    for (const result of [invoiceResult, paymentResult, expenseResult, revenueResult, commissionResult]) {
      if (result.error) throw new HttpError(500, result.error.message);
    }

    const totalInvoiceAmount = sumRows(invoiceResult.data ?? [], "total_amount");
    const totalPaymentAmount = sumRows(paymentResult.data ?? [], "amount");
    const totalExpenseAmount = sumRows(expenseResult.data ?? [], "amount");
    const totalExtraRevenueAmount = sumRows(revenueResult.data ?? [], "amount");
    const totalShoppingCommissionAmount = sumRows(commissionResult.data ?? [], "commission_amount");
    const finalProfitAmount =
      totalInvoiceAmount +
      totalExtraRevenueAmount +
      totalShoppingCommissionAmount -
      totalExpenseAmount;

    const { data: existing, error: existingError } = await supabase
      .from("settlements")
      .select("id, status")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existing && ["approved", "closed"].includes(existing.status)) {
      throw new HttpError(409, `Settlement cannot be recalculated from status ${existing.status}`);
    }

    const { data, error } = await supabase
      .from("settlements")
      .upsert(
        {
          reservation_id: reservationId,
          status: "draft",
          total_invoice_amount: totalInvoiceAmount,
          total_payment_amount: totalPaymentAmount,
          total_expense_amount: totalExpenseAmount,
          total_extra_revenue_amount: totalExtraRevenueAmount,
          total_shopping_commission_amount: totalShoppingCommissionAmount,
          final_profit_amount: finalProfitAmount
        },
        { onConflict: "reservation_id" }
      )
      .select("*")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: financeUser.profileId,
      action: "settlement.recalculated",
      entityTable: "settlements",
      entityId: data.id,
      riskLevel: "high",
      afterData: data
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

function sumRows(rows: any[], field: string) {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

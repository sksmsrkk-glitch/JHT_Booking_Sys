/**
 * @file 한글 책임: `/api/finance/settlements/recalculate` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { computeSettlementTotals } from "@/lib/domain/settlement.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const reservationId = requireUuid(body.reservationId, "reservationId");
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);

    // 잠긴 정산은 재계산 전에 먼저 거릅니다.
    const { data: existing, error: existingError } = await supabase
      .from("settlements")
      .select("id, status")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existing && ["approved", "closed"].includes(existing.status)) {
      throw new HttpError(409, `Settlement cannot be recalculated from status ${existing.status}`);
    }

    const [invoiceResult, paymentResult, expenseResult, revenueResult, commissionResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, tour_code, version_no, total_amount, currency, status")
        .eq("reservation_id", reservationId),
      supabase
        .from("payments")
        .select("amount, status, invoices!inner(reservation_id)")
        .eq("status", "confirmed")
        .eq("invoices.reservation_id", reservationId),
      supabase.from("expenses").select("amount, currency").eq("reservation_id", reservationId),
      supabase.from("extra_revenues").select("amount, currency").eq("reservation_id", reservationId),
      supabase.from("shopping_commissions").select("commission_amount, currency").eq("reservation_id", reservationId)
    ]);

    for (const result of [invoiceResult, paymentResult, expenseResult, revenueResult, commissionResult]) {
      if (result.error) throw new HttpError(500, result.error.message);
    }

    // 재발행 인보이스 중복 합산과 통화 혼합을 도메인 함수에서 방어합니다.
    let totals;
    try {
      totals = computeSettlementTotals({
        invoices: invoiceResult.data ?? [],
        payments: paymentResult.data ?? [],
        expenses: expenseResult.data ?? [],
        extraRevenues: revenueResult.data ?? [],
        commissions: commissionResult.data ?? []
      });
    } catch (settlementError) {
      throw new HttpError(422, settlementError instanceof Error ? settlementError.message : "Settlement inputs are inconsistent");
    }

    // review 상태를 draft로 되돌리지 않도록 기존 상태를 보존합니다.
    const nextStatus = existing?.status === "review" ? "review" : "draft";

    const { data, error } = await supabase
      .from("settlements")
      .upsert(
        {
          reservation_id: reservationId,
          status: nextStatus,
          total_invoice_amount: totals.total_invoice_amount,
          total_payment_amount: totals.total_payment_amount,
          total_expense_amount: totals.total_expense_amount,
          total_extra_revenue_amount: totals.total_extra_revenue_amount,
          total_shopping_commission_amount: totals.total_shopping_commission_amount,
          final_profit_amount: totals.final_profit_amount
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

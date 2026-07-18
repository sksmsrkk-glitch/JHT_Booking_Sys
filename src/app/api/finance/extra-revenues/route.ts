/**
 * @file 한글 책임: `/api/finance/extra-revenues` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { assertFinanceAdjustmentAllowed } from "@/lib/domain/finance.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);
    const amount = requireAmount(body.amount);
    const reservationId = requireUuid(body.reservationId, "reservationId");
    await assertReservationFinanceOpen(supabase, reservationId);

    const { data, error } = await supabase
      .from("extra_revenues")
      .insert({
        reservation_id: reservationId,
        revenue_type: requireString(body.revenueType, "revenueType"),
        description: optionalString(body.description),
        currency: optionalString(body.currency) ?? "KRW",
        amount,
        created_by: financeUser.profileId
      })
      .select("id, reservation_id, revenue_type, description, currency, amount, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: financeUser.profileId,
      action: "extra_revenue.created",
      entityTable: "extra_revenues",
      entityId: data.id,
      riskLevel: "high",
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertReservationFinanceOpen(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from("settlements")
    .select("status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  try {
    assertFinanceAdjustmentAllowed({ settlementStatus: data?.status ?? null });
  } catch (assertionError) {
    throw new HttpError(409, assertionError instanceof Error ? assertionError.message : "Settlement is locked");
  }
}

function requireAmount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, "amount must be a non-negative number");
  }
  return parsed;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

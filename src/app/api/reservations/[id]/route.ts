import { getReservationDetail } from "@/features/reservation/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson } from "@/lib/api/http";
import { planReservationStatusChange } from "@/lib/domain/reservations.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const reservation = await getReservationDetail(supabase, id);
    if (!reservation) throw new HttpError(404, "Reservation not found");

    return ok(reservation);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const nextStatus = typeof body.status === "string" ? body.status : null;
    if (!nextStatus) {
      throw new HttpError(400, "Valid reservation status is required");
    }

    const { data: before, error: beforeError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (beforeError) throw new HttpError(500, beforeError.message);

    // 허용 전이 맵으로 검증하고, 확정/취소 같은 고위험 전이에는 사유를 강제합니다.
    let plan;
    try {
      plan = planReservationStatusChange({
        currentStatus: before.status,
        nextStatus,
        reason: typeof body.reason === "string" ? body.reason : null
      });
    } catch (transitionError) {
      throw new HttpError(400, transitionError instanceof Error ? transitionError.message : "Invalid status transition");
    }

    // update_reservation_status RPC가 상태 변경과 함께 사유를 세션 변수로 남기면,
    // DB 트리거가 reservation_status_history에 이력을 기록합니다(이중 기록 방지를 위해
    // 앱에서 별도로 history를 insert하지 않습니다).
    const { data: after, error: updateError } = await supabase
      .rpc("update_reservation_status", {
        p_reservation_id: id,
        p_status: plan.nextStatus,
        p_reason: plan.reason
      })
      .single();

    if (updateError) throw new HttpError(500, updateError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "reservation.status_updated",
      entityTable: "reservations",
      entityId: id,
      riskLevel: plan.riskLevel,
      beforeData: before,
      afterData: after,
      approvalData: plan.isHighRisk ? { reason: plan.reason } : undefined
    });

    return ok(after);
  } catch (error) {
    return fail(error);
  }
}

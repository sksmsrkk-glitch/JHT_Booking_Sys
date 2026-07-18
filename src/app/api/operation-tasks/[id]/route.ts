/**
 * @file 한글 책임: `/api/operation-tasks/[id]` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { assertReservationOperationsOpen, buildOperationTaskUpdate } from "@/lib/domain/operations.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const taskId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: before, error: beforeError } = await supabase
      .from("operation_tasks")
      .select("*, reservations(status)")
      .eq("id", taskId)
      .single();

    if (beforeError) throw new HttpError(500, beforeError.message);
    try {
      assertReservationOperationsOpen({ reservationStatus: before.reservations?.status });
    } catch (error) {
      throw new HttpError(409, error instanceof Error ? error.message : "Reservation operations are locked");
    }

    const domesticSupplierId = normalizeOptionalUuid(
      body.domesticSupplierId ?? body.domestic_supplier_id,
      "domesticSupplierId"
    );
    if (domesticSupplierId) {
      await assertActiveDomesticSupplier(supabase, domesticSupplierId);
    }

    let update: Record<string, unknown>;
    try {
      update = buildOperationTaskUpdate({
        status: body.status,
        blockedReason: body.blockedReason ?? body.blocked_reason,
        dueAt: body.dueAt ?? body.due_at,
        domesticSupplierId
      }) as unknown as Record<string, unknown>;
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid operation task update");
    }

    if (Object.keys(update).length === 0) {
      throw new HttpError(400, "No operation task fields to update");
    }

    const { data, error } = await supabase
      .from("operation_tasks")
      .update(update)
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "operation_task.updated",
      entityTable: "operation_tasks",
      entityId: taskId,
      beforeData: { ...before, reservations: undefined },
      afterData: data
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertActiveDomesticSupplier(supabase: any, domesticSupplierId: string) {
  const { data, error } = await supabase
    .from("domestic_suppliers")
    .select("id, status")
    .eq("id", domesticSupplierId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Domestic supplier not found");
  if (data.status !== "active") throw new HttpError(409, "Domestic supplier is not active");
}

function normalizeOptionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, field);
}

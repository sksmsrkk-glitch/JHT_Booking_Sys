/**
 * @file 한글 책임: `/api/reservations/[id]/generate-operation-tasks` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError } from "@/lib/api/http";
import { assertReservationOperationsOpen, createDefaultOperationTasks } from "@/lib/domain/operations.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id, status, tour_start_date")
      .eq("id", id)
      .single();

    if (reservationError) throw new HttpError(500, reservationError.message);
    try {
      assertReservationOperationsOpen({ reservationStatus: reservation.status });
    } catch (error) {
      throw new HttpError(409, error instanceof Error ? error.message : "Reservation operations are locked");
    }
    if (!reservation.tour_start_date) throw new HttpError(400, "Reservation tour_start_date is required");

    const { data: existingTasks, error: existingError } = await supabase
      .from("operation_tasks")
      .select("task_type")
      .eq("reservation_id", id);

    if (existingError) throw new HttpError(500, existingError.message);

    const existingTypes = new Set((existingTasks ?? []).map((task: { task_type: string }) => task.task_type));
    const tasks = createDefaultOperationTasks({
      reservationId: id,
      tourStartDate: reservation.tour_start_date,
      createdBy: internalUser.profileId
    }).filter((task: { task_type: string }) => !existingTypes.has(task.task_type));

    if (tasks.length === 0) {
      return created({ insertedCount: 0, tasks: [] });
    }

    const { data, error } = await supabase
      .from("operation_tasks")
      .insert(tasks)
      .select("id, team, task_type, title, status, due_at");

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "operation_tasks.generated",
      entityTable: "reservations",
      entityId: id,
      afterData: { taskCount: data?.length ?? 0 }
    });

    return created({ insertedCount: data?.length ?? 0, tasks: data ?? [] });
  } catch (error) {
    return fail(error);
  }
}

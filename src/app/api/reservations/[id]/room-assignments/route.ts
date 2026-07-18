/**
 * @file 한글 책임: `/api/reservations/[id]/room-assignments` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireArray, requireString, requireUuid } from "@/lib/api/http";
import { assertReservationOperationsOpen } from "@/lib/domain/operations.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const reservationId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    await assertReservationExists(supabase, reservationId);
    const passengerIds = requireArray<unknown>(body.passengerIds ?? [], "passengerIds")
      .map((value, index) => requireUuid(value, `passengerIds[${index}]`));
    if (passengerIds.length === 0) {
      throw new HttpError(400, "At least one passenger is required");
    }
    await assertPassengersBelongToReservation(supabase, reservationId, passengerIds);

    const roomingListId = optionalUuid(body.roomingListId, "roomingListId");
    if (roomingListId) await assertRoomingListBelongsToReservation(supabase, reservationId, roomingListId);

    const { data, error } = await supabase
      .from("room_assignments")
      .insert({
        reservation_id: reservationId,
        rooming_list_id: roomingListId,
        room_no: optionalString(body.roomNo),
        room_type: requireString(body.roomType, "roomType"),
        passenger_ids: passengerIds,
        check_in: optionalString(body.checkIn),
        check_out: optionalString(body.checkOut),
        notes: optionalString(body.notes)
      })
      .select("id, reservation_id, room_no, room_type, passenger_ids, check_in, check_out, notes")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "room_assignment.created",
      entityTable: "room_assignments",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertReservationExists(supabase: any, reservationId: string) {
  const { data, error } = await supabase.from("reservations").select("id, status").eq("id", reservationId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Reservation not found");
  try {
    assertReservationOperationsOpen({ reservationStatus: data.status });
  } catch (assertionError) {
    throw new HttpError(409, assertionError instanceof Error ? assertionError.message : "Reservation operations are locked");
  }
}

async function assertPassengersBelongToReservation(supabase: any, reservationId: string, passengerIds: string[]) {
  const { data, error } = await supabase
    .from("passengers")
    .select("id")
    .eq("reservation_id", reservationId)
    .in("id", passengerIds);

  if (error) throw new HttpError(500, error.message);
  if ((data ?? []).length !== passengerIds.length) {
    throw new HttpError(400, "All passenger IDs must belong to this reservation");
  }
}

async function assertRoomingListBelongsToReservation(supabase: any, reservationId: string, roomingListId: string) {
  const { data, error } = await supabase
    .from("rooming_lists")
    .select("id")
    .eq("id", roomingListId)
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(400, "Rooming list must belong to this reservation");
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return value === undefined || value === null ? null : String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, field);
}

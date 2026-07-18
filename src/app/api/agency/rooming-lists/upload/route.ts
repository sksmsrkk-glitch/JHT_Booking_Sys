/**
 * @file 한글 책임: `/api/agency/rooming-lists/upload` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, optionalPositiveInteger, readJson, requireArray, requireString, requireUuid } from "@/lib/api/http";
import { normalizeRoomingPassengerRows } from "@/lib/domain/rooming-list.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type PassengerInput = {
  passengerNo?: string;
  fullName?: string;
  gender?: string;
  dateOfBirth?: string;
  dietaryRequirements?: string;
  passportNo?: string;
  coachLabel?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const reservationId = requireUuid(body.reservationId, "reservationId");
    await assertAgencyReservation(supabase, reservationId, agencyUser.agencyAccountId);
    const revisionNo = optionalPositiveInteger(body.revisionNo, "revisionNo") ?? (await nextRevisionNo(supabase, reservationId));
    const originalFilename = requireString(body.originalFilename, "originalFilename");
    const storagePath = optionalString(body.storagePath) ?? `agency-rooming/${reservationId}/rev-${revisionNo}/${originalFilename}`;
    const idempotencyKey = String(body.idempotencyKey ?? `${reservationId}:${revisionNo}:${originalFilename}`);
    const passengers = body.passengers ? requireArray<PassengerInput>(body.passengers, "passengers") : [];
    const normalizedPassengers = normalizeRoomingPassengerRows(passengers);
    if (normalizedPassengers.errors.length > 0) {
      throw new HttpError(400, normalizedPassengers.errors.join("; "));
    }

    const { data: roomingList, error: roomingError } = await supabase
      .from("rooming_lists")
      .upsert(
        {
          reservation_id: reservationId,
          uploaded_by_agency_user_id: agencyUser.agencyUserId,
          original_filename: originalFilename,
          storage_path: storagePath,
          revision_no: revisionNo,
          parsed_status: passengers.length > 0 ? "parsed" : "uploaded",
          idempotency_key: idempotencyKey
        },
        { onConflict: "idempotency_key" }
      )
      .select("id, reservation_id, revision_no, parsed_status, created_at")
      .single();

    if (roomingError) throw new HttpError(500, roomingError.message);

    if (normalizedPassengers.rows.length > 0) {
      // 새로 파싱된 파일은 해당 예약의 최신 승객 원장으로 취급합니다.
      // 먼저 업서트가 성공한 뒤, 새 파일에서 빠진 기존 승객만 정리해 데이터 손실 위험을 줄입니다.
      const { data: existingPassengers, error: existingError } = await supabase
        .from("passengers")
        .select("id, passenger_no")
        .eq("reservation_id", reservationId);

      if (existingError) throw new HttpError(500, existingError.message);

      const incomingPassengerNos = new Set(normalizedPassengers.passengerNos);
      const stalePassengerIds = (existingPassengers ?? [])
        .filter((passenger: { id: string; passenger_no: string | null }) => !incomingPassengerNos.has(String(passenger.passenger_no ?? "")))
        .map((passenger: { id: string }) => passenger.id);

      const rows = normalizedPassengers.rows.map((passenger) => ({
        reservation_id: reservationId,
        rooming_list_id: roomingList.id,
        passenger_no: passenger.passengerNo,
        full_name: requireString(passenger.fullName, "passenger.fullName"),
        gender: passenger.gender ?? null,
        date_of_birth: passenger.dateOfBirth ?? null,
        dietary_requirements: passenger.dietaryRequirements ?? null,
        passport_no: passenger.passportNo ?? null,
        coach_label: passenger.coachLabel ?? null,
        metadata: passenger.metadata ?? {}
      }));

      const { error: passengerError } = await supabase
        .from("passengers")
        .upsert(rows, { onConflict: "reservation_id,passenger_no" });

      if (passengerError) throw new HttpError(500, passengerError.message);

      if (stalePassengerIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("passengers")
          .delete()
          .in("id", stalePassengerIds);

        if (deleteError) throw new HttpError(500, deleteError.message);
      }
    }

    return created({ roomingList, passengerCount: passengers.length });
  } catch (error) {
    return fail(error);
  }
}

async function assertAgencyReservation(supabase: any, reservationId: string, agencyAccountId: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, agency_account_id, status")
    .eq("id", reservationId)
    .eq("agency_account_id", agencyAccountId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Reservation not found");
  if (data.status === "cancelled") throw new HttpError(409, "Cancelled reservation cannot receive rooming lists");
}

async function nextRevisionNo(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from("rooming_lists")
    .select("revision_no")
    .eq("reservation_id", reservationId)
    .order("revision_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  return Number(data?.revision_no ?? 0) + 1;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return value === undefined || value === null ? null : String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

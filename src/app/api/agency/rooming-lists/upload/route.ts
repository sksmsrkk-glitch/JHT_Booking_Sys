import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, optionalPositiveInteger, readJson, requireArray, requireString, requireUuid } from "@/lib/api/http";
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
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const reservationId = requireUuid(body.reservationId, "reservationId");
    const revisionNo = optionalPositiveInteger(body.revisionNo, "revisionNo") ?? 1;
    const originalFilename = requireString(body.originalFilename, "originalFilename");
    const storagePath = requireString(body.storagePath, "storagePath");
    const idempotencyKey = String(body.idempotencyKey ?? `${reservationId}:${revisionNo}:${originalFilename}`);

    const { data: roomingList, error: roomingError } = await supabase
      .from("rooming_lists")
      .upsert(
        {
          reservation_id: reservationId,
          uploaded_by_agency_user_id: agencyUser.agencyUserId,
          original_filename: originalFilename,
          storage_path: storagePath,
          revision_no: revisionNo,
          idempotency_key: idempotencyKey
        },
        { onConflict: "idempotency_key" }
      )
      .select("id, reservation_id, revision_no, parsed_status, created_at")
      .single();

    if (roomingError) throw new HttpError(500, roomingError.message);

    const passengers = body.passengers ? requireArray<PassengerInput>(body.passengers, "passengers") : [];
    if (passengers.length > 0) {
      const rows = passengers.map((passenger, index) => ({
        reservation_id: reservationId,
        rooming_list_id: roomingList.id,
        passenger_no: passenger.passengerNo ?? String(index + 1),
        full_name: requireString(passenger.fullName, `passengers[${index}].fullName`),
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
    }

    return created({ roomingList, passengerCount: passengers.length });
  } catch (error) {
    return fail(error);
  }
}

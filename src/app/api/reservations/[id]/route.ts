import { RESERVATION_STATUSES, getReservationDetail } from "@/features/reservation/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson } from "@/lib/api/http";
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
    if (!nextStatus || !RESERVATION_STATUSES.includes(nextStatus)) {
      throw new HttpError(400, "Valid reservation status is required");
    }

    const { data: before, error: beforeError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (beforeError) throw new HttpError(500, beforeError.message);

    const update: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "confirmed" && !before.confirmed_at) {
      update.confirmed_at = new Date().toISOString();
    }
    if (nextStatus === "cancelled" && !before.cancelled_at) {
      update.cancelled_at = new Date().toISOString();
    }

    const { data: after, error: updateError } = await supabase
      .from("reservations")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) throw new HttpError(500, updateError.message);

    const { error: historyError } = await supabase.from("reservation_status_history").insert({
      reservation_id: id,
      from_status: before.status,
      to_status: nextStatus,
      reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
      changed_by: internalUser.profileId
    });

    if (historyError) throw new HttpError(500, historyError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "reservation.status_updated",
      entityTable: "reservations",
      entityId: id,
      beforeData: before,
      afterData: after
    });

    return ok(after);
  } catch (error) {
    return fail(error);
  }
}

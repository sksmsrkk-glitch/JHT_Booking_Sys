/**
 * @file 한글 책임: `/api/reservations` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listReservationPage } from "@/features/reservation/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok, okPaginated } from "@/lib/api/http";
import { writeAuditLog } from "@/lib/api/audit";
import { created, HttpError, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { parsePagination } from "@/lib/api/pagination";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/reservations", async (request: Request) => {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const pagination = parsePagination(url.searchParams);
    const reservations = await listReservationPage(
      supabase,
      {
        q: url.searchParams.get("q") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        agencyAccountId: url.searchParams.get("agencyAccountId") ?? undefined,
        sortBy: url.searchParams.get("sortBy") ?? undefined
      },
      pagination
    );

    return okPaginated(reservations.items, reservations.pagination);
  } catch (error) {
    return fail(error);
  }
});

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const quoteCaseId = requireUuid(body.quoteCaseId, "quoteCaseId");

    const { data: quoteCase, error: quoteCaseError } = await supabase
      .from("quote_cases")
      .select("id, case_code, agency_account_id, status, start_date, end_date")
      .eq("id", quoteCaseId)
      .maybeSingle();

    if (quoteCaseError) throw new HttpError(500, quoteCaseError.message);
    if (!quoteCase) throw new HttpError(404, "Quote case not found");
    if (quoteCase.status !== "accepted") {
      throw new HttpError(409, `Quote case must be accepted before reservation creation`);
    }

    const acceptedVersion = await resolveAcceptedVersion(supabase, quoteCaseId, body.acceptedQuoteVersionId);

    const { data: existingReservation, error: existingError } = await supabase
      .from("reservations")
      .select("id, reservation_code, status, quote_case_id, accepted_quote_version_id")
      .eq("quote_case_id", quoteCaseId)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existingReservation) {
      return ok({ reservation: existingReservation, existing: true });
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        quote_case_id: quoteCase.id,
        accepted_quote_version_id: acceptedVersion.id,
        reservation_code: quoteCase.case_code,
        agency_account_id: quoteCase.agency_account_id,
        status: "requested",
        tour_start_date: optionalString(body.tourStartDate) ?? quoteCase.start_date,
        tour_end_date: optionalString(body.tourEndDate) ?? quoteCase.end_date
      })
      .select("id, reservation_code, status, quote_case_id, accepted_quote_version_id, tour_start_date, tour_end_date")
      .single();

    if (reservationError) throw new HttpError(500, reservationError.message);

    const { error: historyError } = await supabase.from("reservation_status_history").insert({
      reservation_id: reservation.id,
      from_status: null,
      to_status: "requested",
      reason: optionalString(body.reason) ?? "Created from accepted quote version",
      changed_by: internalUser.profileId
    });

    if (historyError) throw new HttpError(500, historyError.message);

    const { error: workflowLinkError } = await supabase
      .from("workflow_threads")
      .update({ reservation_id: reservation.id, updated_at: new Date().toISOString() })
      .eq("workflow_code", quoteCase.case_code);
    if (workflowLinkError) throw new HttpError(500, workflowLinkError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "reservation.created_from_quote",
      entityTable: "reservations",
      entityId: reservation.id,
      afterData: { reservation, quoteCaseId, acceptedQuoteVersionId: acceptedVersion.id }
    });

    return created({ reservation, existing: false });
  } catch (error) {
    return fail(error);
  }
}

async function resolveAcceptedVersion(supabase: any, quoteCaseId: string, rawQuoteVersionId: unknown) {
  let query = supabase
    .from("quote_versions")
    .select("id, quote_case_id, version_no, status")
    .eq("quote_case_id", quoteCaseId)
    .eq("status", "accepted");

  if (rawQuoteVersionId) {
    query = query.eq("id", requireUuid(rawQuoteVersionId, "acceptedQuoteVersionId"));
  } else {
    query = query.order("version_no", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(409, "Accepted quote version is required");
  return data;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return value === undefined || value === null ? null : String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @file 한글 책임: `/api/reservations/[id]/final-operation-snapshot` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { buildInvoiceFromFinalQuote } from "@/features/finance/auto-invoice";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson } from "@/lib/api/http";
import { findFinalSnapshotIssueBlocker } from "@/lib/domain/final-operation-snapshot.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

/*
 * 확정서(final confirmation) 저장 API입니다.
 *
 * accepted quote는 파트너가 수락한 견적 기준이고, final operation snapshot은
 * 내부 오퍼레이터가 실제 예약 확정 후 정리한 최종 호텔/룸타입/식사/일정/항공/계좌 정보입니다.
 * 이 스냅샷이 finalized 상태가 되면 인보이스 자동 발행의 기준 데이터가 됩니다.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const { data, error } = await supabase
      .from("reservation_final_operation_snapshots")
      .select("*")
      .eq("reservation_id", id)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    return ok(data ?? null);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const status = body.status === "finalized" ? "finalized" : "draft";

    // JSON textarea 대신 화면 표 형태로 입력한 내용을 DB JSONB 스냅샷으로 보존합니다.
    // quote itinerary와 달리 이 값은 "실제 예약 확정 후 최종 안내 기준"입니다.
    const snapshotInput = {
      reservation_id: id,
      status,
      day_snapshots: normalizeArray(body.daySnapshots),
      hotel_snapshot: normalizeArray(body.hotelSnapshot),
      meal_snapshot: normalizeArray(body.mealSnapshot),
      flight_details: normalizeArray(body.flightDetails),
      bank_account_snapshot: normalizeObject(body.bankAccountSnapshot),
      operator_notes: optionalString(body.operatorNotes),
      finalized_by: status === "finalized" ? internalUser.profileId : null,
      finalized_at: status === "finalized" ? new Date().toISOString() : null,
      created_by: internalUser.profileId,
      updated_by: internalUser.profileId
    };

    // 인보이스 발행 요청이면 프론트 검증과 별개로 서버에서도 플레이스홀더/빈 값을 거부합니다.
    // (프로젝트 규칙: 인보이스 발행 같은 고위험 로직은 프론트 검증만 신뢰하지 않습니다)
    if (status === "finalized" && body.issueInvoice === true) {
      const blocker = findFinalSnapshotIssueBlocker(snapshotInput);
      if (blocker) throw new HttpError(422, blocker);
    }

    const { data: snapshot, error: snapshotError } = await supabase
      .from("reservation_final_operation_snapshots")
      .upsert(snapshotInput, { onConflict: "reservation_id" })
      .select("*")
      .single();

    if (snapshotError) throw new HttpError(500, snapshotError.message);

    let invoiceResult = null;
    if (status === "finalized" && body.issueInvoice === true) {
      // 확정서 완료와 동시에 인보이스를 발행할 수 있습니다.
      // 인보이스는 accepted quote item + final operation snapshot을 합쳐 생성합니다.
      invoiceResult = await createInvoiceFromFinalSnapshot(supabase, id, snapshot);
    }

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: status === "finalized" ? "reservation_final_snapshot.finalized" : "reservation_final_snapshot.saved",
      entityTable: "reservation_final_operation_snapshots",
      entityId: snapshot.id,
      afterData: { snapshot, invoiceResult }
    });

    return created({ snapshot, invoice: invoiceResult });
  } catch (error) {
    return fail(error);
  }
}

async function createInvoiceFromFinalSnapshot(supabase: any, reservationId: string, snapshot: Record<string, unknown>) {
  // 같은 예약에 여러 인보이스 버전이 생길 수 있으므로 최신 version_no 다음 번호를 사용합니다.
  // 변경 요청으로 금액/일정이 바뀌면 v2, v3 방식으로 이어집니다.
  const { reservation, quoteCase, quoteVersion, quoteItems, itineraryDays } = await loadInvoiceSourceData(
    supabase,
    reservationId
  );
  const latestVersionNo = await getLatestInvoiceVersionNo(supabase, reservationId);
  const draft = buildInvoiceFromFinalQuote({
    reservation,
    quoteCase,
    quoteVersion,
    quoteItems,
    itineraryDays,
    finalSnapshot: {
      day_snapshots: normalizeArray(snapshot.day_snapshots),
      hotel_snapshot: normalizeArray(snapshot.hotel_snapshot),
      meal_snapshot: normalizeArray(snapshot.meal_snapshot),
      flight_details: normalizeArray(snapshot.flight_details),
      bank_account_snapshot: normalizeObject(snapshot.bank_account_snapshot),
      operator_notes: optionalString(snapshot.operator_notes)
    },
    versionNo: latestVersionNo + 1
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert(draft.invoice)
    .select("id, invoice_no, tour_code, version_no, status, currency, total_amount")
    .single();

  if (invoiceError) throw new HttpError(500, invoiceError.message);

  if (draft.lineItems.length > 0) {
    const { error: lineError } = await supabase.from("invoice_line_items").insert(
      draft.lineItems.map((item) => ({
        ...item,
        invoice_id: invoice.id
      }))
    );
    if (lineError) {
      // 자동 생성 중 라인 저장이 실패하면 부분 인보이스가 다음 버전으로 오인되지 않도록 정리합니다.
      await supabase.from("invoices").delete().eq("id", invoice.id);
      throw new HttpError(500, lineError.message);
    }
  }

  return { ...invoice, lineItemCount: draft.lineItems.length };
}

async function loadInvoiceSourceData(supabase: any, reservationId: string) {
  // 자동 인보이스 생성은 반드시 accepted quote version이 연결된 예약에서만 가능합니다.
  // 임시 견적이나 미수락 견적을 기준으로 청구서가 나가면 안 되기 때문입니다.
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, accepted_quote_version_id, quote_cases(id, case_code, tour_name, currency, estimated_pax)"
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError) throw new HttpError(500, reservationError.message);
  if (!reservation) throw new HttpError(404, "Reservation not found");
  if (!reservation.accepted_quote_version_id) throw new HttpError(409, "Accepted quote version is required");

  const [{ data: quoteVersion, error: quoteVersionError }, { data: quoteItems, error: itemError }, { data: itineraryDays, error: dayError }] =
    await Promise.all([
      supabase
        .from("quote_versions")
        .select(
          "id, version_no, status, currency, public_total_amount, public_fare_options, terms_and_conditions, accepted_at"
        )
        .eq("id", reservation.accepted_quote_version_id)
        .maybeSingle(),
      supabase
        .from("quote_items")
        .select(
          "id, item_category, service_section, snapshot_item_name, pricing_unit, quantity, pax_count, total_sell_amount, partner_visible_notes"
        )
        .eq("quote_version_id", reservation.accepted_quote_version_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("quote_itinerary_days")
        .select("id, day_no, service_date, title, meal_summary, public_description")
        .eq("quote_version_id", reservation.accepted_quote_version_id)
        .order("day_no", { ascending: true })
    ]);

  if (quoteVersionError) throw new HttpError(500, quoteVersionError.message);
  if (itemError) throw new HttpError(500, itemError.message);
  if (dayError) throw new HttpError(500, dayError.message);
  if (!quoteVersion || quoteVersion.status !== "accepted") {
    throw new HttpError(409, "Quote version must be accepted before invoice generation");
  }

  return {
    reservation,
    quoteCase: reservation.quote_cases,
    quoteVersion,
    quoteItems: quoteItems ?? [],
    itineraryDays: itineraryDays ?? []
  };
}

async function getLatestInvoiceVersionNo(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("version_no")
    .eq("reservation_id", reservationId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  return Number(data?.version_no ?? 0);
}

function normalizeArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

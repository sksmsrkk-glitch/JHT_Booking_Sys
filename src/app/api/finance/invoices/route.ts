/**
 * @file 한글 책임: `/api/finance/invoices` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listInvoicePage } from "@/features/finance/queries";
import { requireFinanceUser } from "@/lib/api/auth";
import { created, fail, HttpError, okPaginated, readJson, requireUuid } from "@/lib/api/http";
import { parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/finance/invoices", async (request: Request) => {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireFinanceUser(supabase);

    const url = new URL(request.url);
    const pagination = parsePagination(url.searchParams);
    const invoices = await listInvoicePage(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    }, pagination);

    return okPaginated(invoices.items, invoices.pagination);
  } catch (error) {
    return fail(error);
  }
});

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const reservationId = requireUuid(body.reservationId, "reservationId");

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id, status, accepted_quote_version_id, reservation_code, quote_cases(case_code)")
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationError) throw new HttpError(500, reservationError.message);
    if (!reservation) throw new HttpError(404, "Reservation not found");
    if (reservation.status === "cancelled") throw new HttpError(409, "Cancelled reservation cannot be invoiced");
    if (!reservation.accepted_quote_version_id) {
      throw new HttpError(409, "Reservation must have an accepted quote version before invoice creation");
    }

    const quoteCase = Array.isArray(reservation.quote_cases) ? reservation.quote_cases[0] : reservation.quote_cases;
    const tourCode = optionalString(quoteCase?.case_code) ?? optionalString(reservation.reservation_code);
    if (!tourCode) throw new HttpError(409, "Reservation does not have a canonical workflow code");
    const quoteVersion = await getAcceptedQuoteVersion(supabase, reservation.accepted_quote_version_id);
    const totalAmount = optionalNumber(body.totalAmount) ?? Number(quoteVersion.public_total_amount ?? 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new HttpError(409, "Invoice total amount must be greater than zero");
    }

    // 인보이스 발행은 고위험 액션이므로 기본값을 draft로 두고, issued는 명시적으로 요청해야 합니다.
    const status = optionalString(body.status) ?? "draft";
    if (!["draft", "issued"].includes(status)) {
      throw new HttpError(400, "Invoice status must be draft or issued");
    }
    const versionNo = optionalNumber(body.versionNo);
    const lineItems = normalizeLineItems(body.lineItems, optionalString(body.currency) ?? quoteVersion.currency ?? "KRW");
    // 각 라인 합계가 수량 x 단가와 크게 어긋나면 오타로 보고 거부합니다(임의 금액 청구 방지).
    for (const item of lineItems) {
      const expected = roundMoney(item.quantity * item.unit_amount);
      if (Math.abs(expected - item.total_amount) > 0.01) {
        throw new HttpError(
          400,
          `Invoice line "${item.description}" total ${item.total_amount} does not match quantity x unit ${expected}`
        );
      }
    }
    const computedLineTotal = lineItems.reduce((sum, item) => sum + item.total_amount, 0);
    const finalTotal = computedLineTotal > 0 ? computedLineTotal : roundMoney(totalAmount);

    // 버전 할당부터 라인/워크플로우/감사 로그까지 DB의 단일 트랜잭션에서 처리합니다.
    const { data: result, error: invoiceError } = await supabase.rpc("create_invoice_version_atomic", {
      p_reservation_id: reservationId,
      p_status: status,
      p_currency: optionalString(body.currency) ?? quoteVersion.currency ?? "KRW",
      p_total_amount: finalTotal,
      p_due_date: optionalString(body.dueDate),
      p_payment_deadline: optionalString(body.paymentDeadline) ?? optionalString(body.dueDate),
      p_collection_timing: optionalString(body.collectionTiming),
      p_collection_status: optionalString(body.collectionStatus) ?? "unpaid",
      p_deposit_required: Boolean(body.depositRequired),
      p_deposit_amount: optionalNumber(body.depositAmount),
      p_storage_path: optionalString(body.storagePath),
      p_bank_account_snapshot: optionalJsonObject(body.bankAccountSnapshot),
      p_flight_details: optionalJsonArray(body.flightDetails),
      p_itinerary_snapshot: optionalJsonArray(body.itinerarySnapshot),
      p_invoice_payload: optionalJsonObject(body.invoicePayload),
      p_line_items: lineItems,
      p_actor_profile_id: financeUser.profileId,
      p_idempotency_key: request.headers.get("idempotency-key")?.trim() || null,
      p_requested_version: versionNo
    });
    if (invoiceError) throw new HttpError(500, invoiceError.message);

    return created(result);
  } catch (error) {
    return fail(error);
  }
}

async function getAcceptedQuoteVersion(supabase: any, quoteVersionId: string) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, status, currency, public_total_amount")
    .eq("id", quoteVersionId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data || data.status !== "accepted") throw new HttpError(409, "Accepted quote version is required");
  return data;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return value === undefined || value === null ? null : String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function optionalJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function optionalJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeLineItems(value: unknown, fallbackCurrency: string) {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const description = optionalString(row.description);
      if (!description) return null;
      const quantity = optionalNumber(row.quantity) ?? 1;
      const unitAmount = optionalNumber(row.unitAmount) ?? optionalNumber(row.unit_amount) ?? 0;
      const totalAmount = optionalNumber(row.totalAmount) ?? optionalNumber(row.total_amount) ?? quantity * unitAmount;
      return {
        line_no: optionalNumber(row.lineNo) ?? optionalNumber(row.line_no) ?? index + 1,
        description,
        service_date: optionalString(row.serviceDate) ?? optionalString(row.service_date),
        category: optionalString(row.category),
        currency: optionalString(row.currency) ?? fallbackCurrency,
        unit_amount: roundMoney(unitAmount),
        quantity,
        unit_label: optionalString(row.unitLabel) ?? optionalString(row.unit_label),
        total_amount: roundMoney(totalAmount),
        notes: optionalString(row.notes),
        metadata: optionalJsonObject(row.metadata)
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

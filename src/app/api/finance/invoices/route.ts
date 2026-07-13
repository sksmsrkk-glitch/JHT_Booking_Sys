import { listInvoices } from "@/features/finance/queries";
import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { makeVersionedDocumentNo } from "@/lib/domain/workflow-code.mjs";
import { assertFinanceEntryAllowed } from "@/lib/domain/finance.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireFinanceUser(supabase);

    const url = new URL(request.url);
    const invoices = await listInvoices(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    });

    return ok(invoices);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  let supabase: ReturnType<typeof createRequestSupabaseClient> | null = null;
  let createdInvoiceId: string | null = null;
  try {
    supabase = createRequestSupabaseClient(request);
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
    const { data: latestInvoice, error: existingError } = await supabase
      .from("invoices")
      .select("id, invoice_no, status, reservation_id, total_amount, version_no")
      .eq("tour_code", tourCode)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    await assertReservationFinanceOpen(supabase, reservationId);

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
    const versionNo = optionalNumber(body.versionNo) ?? Number(latestInvoice?.version_no ?? 0) + 1;
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

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        reservation_id: reservationId,
        invoice_no: makeVersionedDocumentNo(tourCode, "INV", versionNo),
        tour_code: tourCode,
        version_no: versionNo,
        status,
        currency: optionalString(body.currency) ?? quoteVersion.currency ?? "KRW",
        total_amount: finalTotal,
        issued_at: status === "issued" ? new Date().toISOString() : null,
        due_date: optionalString(body.dueDate),
        payment_deadline: optionalString(body.paymentDeadline) ?? optionalString(body.dueDate),
        collection_timing: optionalString(body.collectionTiming),
        collection_status: optionalString(body.collectionStatus) ?? "unpaid",
        deposit_required: Boolean(body.depositRequired),
        deposit_amount: optionalNumber(body.depositAmount),
        storage_path: optionalString(body.storagePath),
        bank_account_snapshot: optionalJsonObject(body.bankAccountSnapshot),
        flight_details: optionalJsonArray(body.flightDetails),
        itinerary_snapshot: optionalJsonArray(body.itinerarySnapshot),
        invoice_payload: optionalJsonObject(body.invoicePayload)
      })
      .select("id, invoice_no, tour_code, version_no, status, reservation_id, currency, total_amount, issued_at, due_date, payment_deadline, collection_status")
      .single();

    if (invoiceError) throw new HttpError(500, invoiceError.message);
    createdInvoiceId = invoice.id;

    if (lineItems.length > 0) {
      const { error: lineItemError } = await supabase.from("invoice_line_items").insert(
        lineItems.map((item) => ({
          ...item,
          invoice_id: invoice.id
        }))
      );
      if (lineItemError) throw new HttpError(500, lineItemError.message);
    }

    const { error: workflowLinkError } = await supabase
      .from("workflow_threads")
      .update({ current_invoice_id: invoice.id, updated_at: new Date().toISOString() })
      .eq("workflow_code", tourCode);
    if (workflowLinkError) throw new HttpError(500, workflowLinkError.message);

    await writeAuditLog(supabase, {
      actorProfileId: financeUser.profileId,
      action: status === "issued" ? "invoice.issued" : "invoice.created",
      entityTable: "invoices",
      entityId: invoice.id,
      riskLevel: status === "issued" ? "high" : "normal",
      afterData: {
        invoice,
        lineItemCount: lineItems.length,
        previousInvoiceId: latestInvoice?.id ?? null,
        reservationId,
        acceptedQuoteVersionId: reservation.accepted_quote_version_id
      }
    });

    createdInvoiceId = null;
    return created({ invoice, existing: false, previousInvoice: latestInvoice ?? null });
  } catch (error) {
    // 라인, 워크플로우 연결, 감사 로그 중 하나라도 실패하면 불완전한 인보이스를 남기지 않습니다.
    if (supabase && createdInvoiceId) {
      await supabase.from("invoices").delete().eq("id", createdInvoiceId);
    }
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

async function assertReservationFinanceOpen(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from("settlements")
    .select("status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  try {
    assertFinanceEntryAllowed({ settlementStatus: data?.status ?? null });
  } catch (error) {
    throw new HttpError(409, error instanceof Error ? error.message : "Finance entries are locked");
  }
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

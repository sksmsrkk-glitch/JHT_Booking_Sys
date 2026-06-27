import { listInvoices } from "@/features/finance/queries";
import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { makeInvoiceNo } from "@/lib/domain/ids";
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
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const reservationId = requireUuid(body.reservationId, "reservationId");
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id, status, accepted_quote_version_id, reservation_code")
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationError) throw new HttpError(500, reservationError.message);
    if (!reservation) throw new HttpError(404, "Reservation not found");
    if (reservation.status === "cancelled") throw new HttpError(409, "Cancelled reservation cannot be invoiced");
    if (!reservation.accepted_quote_version_id) {
      throw new HttpError(409, "Reservation must have an accepted quote version before invoice creation");
    }

    const { data: existingInvoice, error: existingError } = await supabase
      .from("invoices")
      .select("id, invoice_no, status, reservation_id, total_amount")
      .eq("reservation_id", reservationId)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existingInvoice) return ok({ invoice: existingInvoice, existing: true });
    await assertReservationFinanceOpen(supabase, reservationId);

    const quoteVersion = await getAcceptedQuoteVersion(supabase, reservation.accepted_quote_version_id);
    const totalAmount = optionalNumber(body.totalAmount) ?? Number(quoteVersion.public_total_amount ?? 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new HttpError(409, "Invoice total amount must be greater than zero");
    }

    const status = optionalString(body.status) ?? "issued";
    if (!["draft", "issued"].includes(status)) {
      throw new HttpError(400, "Invoice status must be draft or issued");
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        reservation_id: reservationId,
        invoice_no: optionalString(body.invoiceNo) ?? makeInvoiceNo(),
        status,
        currency: optionalString(body.currency) ?? quoteVersion.currency ?? "KRW",
        total_amount: roundMoney(totalAmount),
        issued_at: status === "issued" ? new Date().toISOString() : null,
        due_date: optionalString(body.dueDate),
        storage_path: optionalString(body.storagePath)
      })
      .select("id, invoice_no, status, reservation_id, currency, total_amount, issued_at, due_date")
      .single();

    if (invoiceError) throw new HttpError(500, invoiceError.message);

    await writeAuditLog(supabase, {
      actorProfileId: financeUser.profileId,
      action: "invoice.created",
      entityTable: "invoices",
      entityId: invoice.id,
      afterData: { invoice, reservationId, acceptedQuoteVersionId: reservation.accepted_quote_version_id }
    });

    return created({ invoice, existing: false });
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

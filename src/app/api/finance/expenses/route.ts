import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { assertFinanceAdjustmentAllowed } from "@/lib/domain/finance.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);
    const amount = requireAmount(body.amount);
    const reservationId = requireUuid(body.reservationId, "reservationId");
    await assertReservationFinanceOpen(supabase, reservationId);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        reservation_id: reservationId,
        domestic_supplier_id: optionalUuid(body.domesticSupplierId, "domesticSupplierId"),
        expense_date: optionalString(body.expenseDate),
        category: requireString(body.category, "category"),
        description: requireString(body.description, "description"),
        currency: optionalString(body.currency) ?? "KRW",
        amount,
        receipt_storage_path: optionalString(body.receiptStoragePath),
        created_by: financeUser.profileId
      })
      .select("id, reservation_id, category, description, currency, amount, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: financeUser.profileId,
      action: "expense.created",
      entityTable: "expenses",
      entityId: data.id,
      riskLevel: "high",
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertReservationFinanceOpen(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from("settlements")
    .select("status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  try {
    assertFinanceAdjustmentAllowed({ settlementStatus: data?.status ?? null });
  } catch (assertionError) {
    throw new HttpError(409, assertionError instanceof Error ? assertionError.message : "Settlement is locked");
  }
}

function requireAmount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, "amount must be a non-negative number");
  }
  return parsed;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, field);
}

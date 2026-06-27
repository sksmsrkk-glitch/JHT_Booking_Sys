import { requireFinanceUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { buildSettlementStatusUpdate } from "@/lib/domain/finance.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const settlementId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const nextStatus = requireString(body.status, "status");
    const supabase = createRequestSupabaseClient(request);
    const financeUser = await requireFinanceUser(supabase);

    const { data: current, error: currentError } = await supabase
      .from("settlements")
      .select("id, reservation_id, status, approved_by, approved_at, final_profit_amount")
      .eq("id", settlementId)
      .maybeSingle();

    if (currentError) throw new HttpError(500, currentError.message);
    if (!current) throw new HttpError(404, "Settlement not found");

    let update: ReturnType<typeof buildSettlementStatusUpdate>;
    try {
      update = buildSettlementStatusUpdate({
        currentStatus: current.status,
        nextStatus,
        actorProfileId: financeUser.profileId
      });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid settlement status transition");
    }

    const { data: updated, error: updateError } = await supabase
      .from("settlements")
      .update(update)
      .eq("id", settlementId)
      .select("id, reservation_id, status, approved_by, approved_at, final_profit_amount, updated_at")
      .single();

    if (updateError) throw new HttpError(500, updateError.message);

    await writeAuditLog(supabase, {
      actorProfileId: financeUser.profileId,
      action: "settlement.status_changed",
      entityTable: "settlements",
      entityId: settlementId,
      riskLevel: nextStatus === "approved" || nextStatus === "closed" ? "high" : "normal",
      beforeData: current,
      afterData: updated
    });

    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

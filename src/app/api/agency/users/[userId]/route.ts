import { sendAgencyPasswordReset, setAgencyAuthUsersEnabled } from "@/lib/api/agency-auth-admin";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const targetUserId = requireUuid(userId, "userId");
    const requestSupabase = createRequestSupabaseClient(request);
    const actor = await requireAgencyUser(requestSupabase);
    if (!actor.isAccountAdmin || actor.accountRole !== "mother") throw new HttpError(403, "Mother account permission is required");
    if (targetUserId === actor.agencyUserId) throw new HttpError(409, "Mother account cannot disable itself");

    const body = await readJson<Record<string, unknown>>(request);
    const service = createServiceSupabaseClient();
    const { data: target, error: targetError } = await service
      .from("agency_users")
      .select("id, agency_account_id, auth_user_id, email, account_role, status")
      .eq("id", targetUserId)
      .eq("agency_account_id", actor.agencyAccountId)
      .maybeSingle();
    if (targetError) throw new HttpError(500, targetError.message);
    if (!target || target.account_role !== "sub_account") throw new HttpError(404, "Sub account not found");

    if (body.action === "reset_password") {
      await sendAgencyPasswordReset(target.email, new URL("/agency/login", request.url).toString());
      await service.from("agency_users").update({ password_reset_required: true }).eq("id", target.id);
      return ok({ id: target.id, action: "reset_password" });
    }

    if (body.action !== "activate" && body.action !== "deactivate") throw new HttpError(400, "Unsupported account action");
    const active = body.action === "activate";
    await setAgencyAuthUsersEnabled([target.auth_user_id], active);
    const { data, error } = await service
      .from("agency_users")
      .update({ status: active ? "active" : "inactive", forced_withdrawn_at: active ? null : new Date().toISOString() })
      .eq("id", target.id)
      .select("id, email, name, title, account_role, status, last_login_at, created_at")
      .single();
    if (error) throw new HttpError(500, error.message);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

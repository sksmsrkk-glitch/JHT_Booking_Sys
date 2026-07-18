/**
 * @file 한글 책임: `/api/agencies/[id]/users/[userId]` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { writeAuditLog } from "@/lib/api/audit";
import { sendAgencyPasswordReset, setAgencyAuthUsersEnabled } from "@/lib/api/agency-auth-admin";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await context.params;
    const agencyAccountId = requireUuid(id, "id");
    const agencyUserId = requireUuid(userId, "userId");
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);

    const patch: Record<string, unknown> = {};
    if (body.status === "active" || body.status === "inactive") {
      patch.status = body.status;
      patch.forced_withdrawn_at = body.status === "inactive" ? new Date().toISOString() : null;
    }
    if (typeof body.passwordResetRequired === "boolean") {
      patch.password_reset_required = body.passwordResetRequired;
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, "No supported user fields were provided");

    const { data: user, error } = await supabase
      .from("agency_users")
      .update(patch)
      .eq("id", agencyUserId)
      .eq("agency_account_id", agencyAccountId)
      .select("id, agency_account_id, auth_user_id, email, name, status, password_reset_required")
      .single();
    if (error) throw new HttpError(500, error.message);

    if (patch.status) {
      await setAgencyAuthUsersEnabled([user.auth_user_id], patch.status === "active");
    }
    if (patch.password_reset_required === true) {
      await sendAgencyPasswordReset(user.email, new URL("/agency/login", request.url).toString());
    }

    await queueUserEmail(supabase, user, patch);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "agency_user.governance_updated",
      entityTable: "agency_users",
      entityId: agencyUserId,
      afterData: user
    });

    return ok(user);
  } catch (error) {
    return fail(error);
  }
}

async function queueUserEmail(supabase: any, user: any, patch: Record<string, unknown>) {
  const eventType = patch.status === "inactive" ? "user_withdrawn" : "password_reset_requested";
  const subject = patch.status === "inactive" ? "[JHT] Portal user access withdrawn" : "[JHT] Password reset requested";
  const body =
    patch.status === "inactive"
      ? `Your JHT partner portal user access has been withdrawn.`
      : `A JHT partner portal password reset has been requested for ${user.email}.`;

  const { error } = await supabase.from("agency_account_email_events").insert({
    agency_account_id: user.agency_account_id,
    agency_user_id: user.id,
    event_type: eventType,
    recipient_email: user.email,
    subject,
    body,
    delivery_status: "queued"
  });
  if (error) throw new HttpError(500, error.message);
}

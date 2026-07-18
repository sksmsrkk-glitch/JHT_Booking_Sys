/**
 * @file 한글 책임: `/api/agencies/[id]/lifecycle` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { writeAuditLog } from "@/lib/api/audit";
import { setAgencyAuthUsersEnabled } from "@/lib/api/agency-auth-admin";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

const allowedLifecycleStatuses = ["active", "frozen", "withdrawn"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const agencyAccountId = requireUuid(id, "id");
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const lifecycleStatus = requireString(body.lifecycleStatus, "lifecycleStatus");
    if (!allowedLifecycleStatuses.includes(lifecycleStatus as any)) {
      throw new HttpError(400, "lifecycleStatus must be active, frozen, or withdrawn");
    }

    const now = new Date().toISOString();
    const status = lifecycleStatus === "active" ? "active" : "inactive";
    const { data: before, error: beforeError } = await supabase
      .from("agency_accounts")
      .select("id, lifecycle_status")
      .eq("id", agencyAccountId)
      .maybeSingle();
    if (beforeError) throw new HttpError(500, beforeError.message);
    if (!before) throw new HttpError(404, "Agency account not found");
    if (before.lifecycle_status === "withdrawn" && lifecycleStatus !== "withdrawn") {
      throw new HttpError(409, "Withdrawn partner accounts cannot be reactivated");
    }

    const { data: agency, error: updateError } = await supabase
      .from("agency_accounts")
      .update({
        lifecycle_status: lifecycleStatus,
        status,
        frozen_at: lifecycleStatus === "frozen" ? now : null,
        withdrawn_at: lifecycleStatus === "withdrawn" ? now : null
      })
      .eq("id", agencyAccountId)
      .select("id, name, lifecycle_status, status")
      .single();
    if (updateError) throw new HttpError(500, updateError.message);

    const { data: linkedUsers, error: linkedUsersError } = await supabase
      .from("agency_users")
      .select("id, auth_user_id, forced_withdrawn_at, suspended_by_account_at")
      .eq("agency_account_id", agencyAccountId);
    if (linkedUsersError) throw new HttpError(500, linkedUsersError.message);

    if (lifecycleStatus === "frozen") {
      const { error: userError } = await supabase
        .from("agency_users")
        .update({ status: "inactive", suspended_by_account_at: now })
        .eq("agency_account_id", agencyAccountId);
      if (userError) throw new HttpError(500, userError.message);
      await setAgencyAuthUsersEnabled((linkedUsers ?? []).map((user: any) => user.auth_user_id), false);
    } else if (lifecycleStatus === "withdrawn") {
      const { error: userError } = await supabase
        .from("agency_users")
        .update({ status: "inactive", forced_withdrawn_at: now, suspended_by_account_at: null })
        .eq("agency_account_id", agencyAccountId);
      if (userError) throw new HttpError(500, userError.message);
      await setAgencyAuthUsersEnabled((linkedUsers ?? []).map((user: any) => user.auth_user_id), false);
    } else {
      const recoverableIds = (linkedUsers ?? [])
        .filter((user: any) => user.suspended_by_account_at && !user.forced_withdrawn_at)
        .map((user: any) => user.id);
      if (recoverableIds.length > 0) {
        const { error: userError } = await supabase
          .from("agency_users")
          .update({ status: "active", suspended_by_account_at: null })
          .in("id", recoverableIds);
        if (userError) throw new HttpError(500, userError.message);
        await setAgencyAuthUsersEnabled(
          (linkedUsers ?? []).filter((user: any) => recoverableIds.includes(user.id)).map((user: any) => user.auth_user_id),
          true
        );
      }
    }

    await queueLifecycleEmails(supabase, agencyAccountId, agency.name, lifecycleStatus);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: `agency_account.${lifecycleStatus}`,
      entityTable: "agency_accounts",
      entityId: agencyAccountId,
      afterData: agency
    });

    return ok(agency);
  } catch (error) {
    return fail(error);
  }
}

async function queueLifecycleEmails(supabase: any, agencyAccountId: string, agencyName: string, lifecycleStatus: string) {
  const { data: users, error } = await supabase
    .from("agency_users")
    .select("id, email")
    .eq("agency_account_id", agencyAccountId)
    .eq("is_account_admin", true);
  if (error) throw new HttpError(500, error.message);

  const events = (users ?? []).map((user: any) => ({
    agency_account_id: agencyAccountId,
    agency_user_id: user.id,
    event_type: `account_${lifecycleStatus}`,
    recipient_email: user.email,
    subject: `[JHT] Partner account ${lifecycleStatus}`,
    body: `JHT partner account "${agencyName}" status has changed to ${lifecycleStatus}.`,
    delivery_status: "queued"
  }));
  if (events.length === 0) return;

  const { error: insertError } = await supabase.from("agency_account_email_events").insert(events);
  if (insertError) throw new HttpError(500, insertError.message);
}

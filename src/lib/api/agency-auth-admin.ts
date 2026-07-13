import type { SupabaseClient, User } from "@supabase/supabase-js";

import { HttpError } from "./http";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type AuthProvisionResult = {
  authUserId: string;
  invitationSent: boolean;
  created: boolean;
};

/**
 * 파트너 승인/서브 계정 생성 시 Auth 사용자와 public.agency_users를 반드시 연결합니다.
 * 이미 같은 이메일의 Auth 사용자가 있으면 중복 생성하지 않고 기존 ID를 재사용합니다.
 */
export async function provisionAgencyAuthUser(input: {
  email: string;
  name: string;
  accountRole: "mother" | "sub_account";
  redirectTo: string;
}): Promise<AuthProvisionResult> {
  const service = createServiceSupabaseClient();
  const email = input.email.trim().toLowerCase();
  const existing = await findAuthUserByEmail(service, email);

  if (existing) {
    return { authUserId: existing.id, invitationSent: false, created: false };
  }

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: {
      display_name: input.name,
      jht_account_type: "agency",
      jht_agency_role: input.accountRole
    },
    redirectTo: input.redirectTo
  });

  if (error || !data.user) {
    throw new HttpError(502, `Partner Auth invitation failed: ${error?.message ?? "Auth user was not returned"}`);
  }

  return { authUserId: data.user.id, invitationSent: true, created: true };
}

/** 계정 생성 뒤 DB 작업이 실패한 경우에만 방금 만든 Auth 사용자를 보상 삭제합니다. */
export async function rollbackProvisionedAuthUser(result: AuthProvisionResult) {
  if (!result.created) return;
  const service = createServiceSupabaseClient();
  await service.auth.admin.deleteUser(result.authUserId, false);
}

/** 동결/탈퇴 상태를 Supabase Auth에도 반영해 토큰 재발급과 로그인을 함께 차단합니다. */
export async function setAgencyAuthUsersEnabled(authUserIds: Array<string | null | undefined>, enabled: boolean) {
  const service = createServiceSupabaseClient();
  const uniqueIds = [...new Set(authUserIds.filter((value): value is string => Boolean(value)))];

  for (const authUserId of uniqueIds) {
    const { error } = await service.auth.admin.updateUserById(authUserId, {
      ban_duration: enabled ? "none" : "876000h"
    });
    if (error) throw new HttpError(502, `Partner Auth access update failed: ${error.message}`);
  }
}

/** 관리자가 요청한 비밀번호 재설정은 실제 Supabase 복구 메일로 전달합니다. */
export async function sendAgencyPasswordReset(email: string, redirectTo: string) {
  const service = createServiceSupabaseClient();
  const { error } = await service.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) throw new HttpError(502, `Password reset email failed: ${error.message}`);
}

async function findAuthUserByEmail(service: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new HttpError(502, `Auth user lookup failed: ${error.message}`);
    const matched = data.users.find((user) => user.email?.toLowerCase() === email);
    if (matched) return matched;
    if (data.users.length < 1000) return null;
  }
  throw new HttpError(409, "Auth user lookup exceeded the supported directory size");
}

/**
 * @file 한글 책임: `/api/agency/users` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { provisionAgencyAuthUser, rollbackProvisionedAuthUser } from "@/lib/api/agency-auth-admin";
import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, ok, optionalString, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const actor = await requireAgencyUser(supabase);
    const { data, error } = await supabase
      .from("agency_users")
      .select("id, email, name, title, account_role, is_account_admin, status, last_login_at, created_at")
      .eq("agency_account_id", actor.agencyAccountId)
      .order("account_role", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new HttpError(500, error.message);
    return ok({ users: data ?? [], canManage: actor.isAccountAdmin && actor.accountRole === "mother", actorUserId: actor.agencyUserId });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const requestSupabase = createRequestSupabaseClient(request);
    const actor = await requireAgencyUser(requestSupabase);
    assertMotherAccount(actor);
    const body = await readJson<Record<string, unknown>>(request);
    const email = requireString(body.email, "email").trim().toLowerCase();
    const name = requireString(body.name, "name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "A valid email is required");

    const provision = await provisionAgencyAuthUser({
      email,
      name,
      accountRole: "sub_account",
      redirectTo: new URL("/agency/login", request.url).toString()
    });

    const service = createServiceSupabaseClient();
    const { data, error } = await service
      .from("agency_users")
      .insert({
        agency_account_id: actor.agencyAccountId,
        auth_user_id: provision.authUserId,
        email,
        name,
        title: optionalString(body.title),
        is_account_admin: false,
        account_role: "sub_account",
        parent_agency_user_id: actor.agencyUserId,
        password_reset_required: true,
        status: "active"
      })
      .select("id, email, name, title, account_role, status, created_at")
      .single();
    if (error) {
      await rollbackProvisionedAuthUser(provision);
      if (error.message.includes("duplicate key")) throw new HttpError(409, "This email already belongs to an agency user");
      throw new HttpError(500, error.message);
    }
    return created({ user: data, invitationSent: provision.invitationSent });
  } catch (error) {
    return fail(error);
  }
}

function assertMotherAccount(actor: Awaited<ReturnType<typeof requireAgencyUser>>) {
  if (!actor.isAccountAdmin || actor.accountRole !== "mother") {
    throw new HttpError(403, "Mother account permission is required");
  }
}

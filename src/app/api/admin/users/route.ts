/**
 * @file 한글 책임: `/api/admin/users` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listInternalUsers } from "@/features/internal-users/queries";
import { requireAdminUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireArray, requireString, requireUuid } from "@/lib/api/http";
import { buildInternalProfileRow, buildInternalUserRoleRows, normalizeRoles } from "@/lib/domain/internal-users.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireAdminUser(supabase);
    return ok(await listInternalUsers(supabase));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const adminUser = await requireAdminUser(supabase);
    const authUserId = requireUuid(body.authUserId, "authUserId");
    const roles = normalizeRoles(requireArray(body.roles, "roles"));
    const companyId = optionalUuid(body.companyId, "companyId");
    if (companyId) {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .eq("status", "active")
        .maybeSingle();

      if (companyError) throw new HttpError(500, companyError.message);
      if (!company) throw new HttpError(400, "companyId must reference an active company");
    }

    const { data: beforeProfile } = await supabase
      .from("profiles")
      .select("id, email, display_name, status, default_company_id, user_roles(role)")
      .eq("id", authUserId)
      .maybeSingle();

    const profileRow = buildInternalProfileRow({
      authUserId,
      email: requireString(body.email, "email"),
      displayName: typeof body.displayName === "string" ? body.displayName : null,
      companyId
    });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" })
      .select("id, email, display_name, status, default_company_id")
      .single();

    if (profileError) throw new HttpError(500, profileError.message);

    const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", authUserId);
    if (deleteError) throw new HttpError(500, deleteError.message);

    const roleRows = buildInternalUserRoleRows({ userId: authUserId, roles });
    const { error: roleError } = await supabase.from("user_roles").insert(roleRows);
    if (roleError) throw new HttpError(500, roleError.message);

    const afterData = {
      profile,
      roles
    };

    await writeAuditLog(supabase, {
      actorProfileId: adminUser.profileId,
      action: "internal_user.roles_set",
      entityTable: "profiles",
      entityId: authUserId,
      riskLevel: roles.includes("admin") || roles.includes("finance") ? "high" : "normal",
      beforeData: beforeProfile ?? null,
      afterData
    });

    return ok(afterData);
  } catch (error) {
    return fail(error);
  }
}

function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, field);
}

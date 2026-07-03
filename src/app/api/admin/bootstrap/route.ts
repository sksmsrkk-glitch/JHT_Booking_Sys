import { createHash, timingSafeEqual } from "node:crypto";

import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import {
  assertBootstrapAllowed,
  buildInitialAdminBootstrapRows,
  buildInitialCompanyBootstrapRow
} from "@/lib/domain/bootstrap.mjs";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const BOOTSTRAP_FLAG_KEY = "initial_admin_bootstrap";

export async function POST(request: Request) {
  try {
    requireBootstrapSecret(request);
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createServiceSupabaseClient();

    const { count, error: countError } = await supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) throw new HttpError(500, countError.message);
    try {
      assertBootstrapAllowed({ adminRoleCount: count ?? 0 });
    } catch (error) {
      throw new HttpError(409, error instanceof Error ? error.message : "Bootstrap is not allowed");
    }

    // 원자적 1회성 클레임: system_flags에 부트스트랩 완료 플래그를 먼저 심습니다.
    // admin 롤이 나중에 모두 삭제되어도 이 플래그가 남아 재부트스트랩을 막고,
    // 동시 요청은 PK 충돌(23505)로 한 건만 통과합니다.
    const { error: flagError } = await supabase
      .from("system_flags")
      .insert({ key: BOOTSTRAP_FLAG_KEY, value: { claimed_at: new Date().toISOString() } });
    if (flagError) {
      if (flagError.code === "23505") {
        throw new HttpError(409, "Initial admin bootstrap has already been completed");
      }
      throw new HttpError(500, flagError.message);
    }

    // 플래그 선점 이후 단계가 실패하면 정상 재시도가 막히므로 플래그를 되돌립니다.
    const releaseFlag = async () => {
      await supabase.from("system_flags").delete().eq("key", BOOTSTRAP_FLAG_KEY);
    };

    let companyRow: ReturnType<typeof buildInitialCompanyBootstrapRow>;
    try {
      companyRow = buildInitialCompanyBootstrapRow({
        code: typeof body.companyCode === "string" ? body.companyCode : "JHT",
        nameKo: typeof body.companyNameKo === "string" ? body.companyNameKo : "정호여행사",
        nameEn: typeof body.companyNameEn === "string" ? body.companyNameEn : "Jungho Travel"
      });
    } catch (error) {
      await releaseFlag();
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid company payload");
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .upsert(companyRow, { onConflict: "code" })
      .select("id, code, name_ko, name_en, status")
      .single();

    if (companyError) {
      await releaseFlag();
      throw new HttpError(500, companyError.message);
    }

    let rows: ReturnType<typeof buildInitialAdminBootstrapRows>;
    try {
      rows = buildInitialAdminBootstrapRows({
        authUserId: requireUuid(body.authUserId, "authUserId"),
        email: requireString(body.email, "email"),
        displayName: typeof body.displayName === "string" ? body.displayName : null,
        companyId: company.id
      });
    } catch (error) {
      await releaseFlag();
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid bootstrap payload");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(rows.profile, { onConflict: "id" })
      .select("id, email, display_name, status")
      .single();

    if (profileError) {
      await releaseFlag();
      throw new HttpError(500, profileError.message);
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(rows.roles, { onConflict: "user_id,role" });

    if (roleError) {
      await releaseFlag();
      throw new HttpError(500, roleError.message);
    }

    await supabase.from("audit_logs").insert({
      actor_profile_id: profile.id,
      action: "bootstrap.initial_admin_created",
      entity_table: "profiles",
      entity_id: profile.id,
      risk_level: "high",
      after_data: { profile, company, roles: rows.roles.map((role) => role.role) }
    });

    return ok({
      profile,
      company,
      roles: rows.roles.map((role) => role.role)
    });
  } catch (error) {
    return fail(error);
  }
}

function requireBootstrapSecret(request: Request) {
  const expected = process.env.INITIAL_ADMIN_BOOTSTRAP_SECRET;
  if (!expected) {
    throw new HttpError(500, "INITIAL_ADMIN_BOOTSTRAP_SECRET is not configured");
  }

  const actual = request.headers.get("x-bootstrap-secret");
  if (typeof actual !== "string" || actual.length === 0) {
    throw new HttpError(401, "Invalid bootstrap secret");
  }
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(actualHash, expectedHash)) {
    throw new HttpError(401, "Invalid bootstrap secret");
  }
}

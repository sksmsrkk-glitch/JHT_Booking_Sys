import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import {
  assertBootstrapAllowed,
  buildInitialAdminBootstrapRows,
  buildInitialCompanyBootstrapRow
} from "@/lib/domain/bootstrap.mjs";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

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

    let companyRow: ReturnType<typeof buildInitialCompanyBootstrapRow>;
    try {
      companyRow = buildInitialCompanyBootstrapRow({
        code: typeof body.companyCode === "string" ? body.companyCode : "JHT",
        nameKo: typeof body.companyNameKo === "string" ? body.companyNameKo : "정호여행사",
        nameEn: typeof body.companyNameEn === "string" ? body.companyNameEn : "Jungho Travel"
      });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid company payload");
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .upsert(companyRow, { onConflict: "code" })
      .select("id, code, name_ko, name_en, status")
      .single();

    if (companyError) throw new HttpError(500, companyError.message);

    let rows: ReturnType<typeof buildInitialAdminBootstrapRows>;
    try {
      rows = buildInitialAdminBootstrapRows({
        authUserId: requireUuid(body.authUserId, "authUserId"),
        email: requireString(body.email, "email"),
        displayName: typeof body.displayName === "string" ? body.displayName : null,
        companyId: company.id
      });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid bootstrap payload");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(rows.profile, { onConflict: "id" })
      .select("id, email, display_name, status")
      .single();

    if (profileError) throw new HttpError(500, profileError.message);

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(rows.roles, { onConflict: "user_id,role" });

    if (roleError) throw new HttpError(500, roleError.message);

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
  if (actual !== expected) {
    throw new HttpError(401, "Invalid bootstrap secret");
  }
}

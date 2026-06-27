import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const agencyAccountId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    await assertAgencyExists(supabase, agencyAccountId);

    const { data, error } = await supabase
      .from("agency_users")
      .insert({
        agency_account_id: agencyAccountId,
        auth_user_id: optionalUuid(body.authUserId, "authUserId"),
        email: requireString(body.email, "email").toLowerCase(),
        name: requireString(body.name, "name"),
        title: optionalString(body.title),
        is_account_admin: optionalBoolean(body.isAccountAdmin) ?? false,
        status: "active"
      })
      .select("id, agency_account_id, auth_user_id, email, name, is_account_admin, status")
      .single();

    if (error) {
      if (error.message?.includes("duplicate key")) {
        throw new HttpError(409, "Agency user email already exists for this agency");
      }
      throw new HttpError(500, error.message);
    }

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "agency_user.created",
      entityTable: "agency_users",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertAgencyExists(supabase: any, agencyAccountId: string) {
  const { data, error } = await supabase.from("agency_accounts").select("id").eq("id", agencyAccountId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Overseas agency not found");
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return Boolean(value);
}

function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, field);
}

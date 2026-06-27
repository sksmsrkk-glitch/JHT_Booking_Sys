import { listAgencyAccounts } from "@/features/agency/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const agencies = await listAgencyAccounts(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      country: url.searchParams.get("country") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    });

    return ok(agencies);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data, error } = await supabase
      .from("agency_accounts")
      .insert({
        company_id: requireUuid(body.companyId, "companyId"),
        name: requireString(body.name, "name"),
        country_code: optionalString(body.countryCode),
        email_domain: optionalString(body.emailDomain),
        phone: optionalString(body.phone),
        website: optionalString(body.website),
        billing_currency: optionalString(body.billingCurrency) ?? "KRW",
        google_drive_folder_url: optionalString(body.googleDriveFolderUrl),
        status: "active"
      })
      .select("id, name, country_code, billing_currency, status")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "agency_account.created",
      entityTable: "agency_accounts",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

import { created, fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/api/auth";
import { listAgencySignupApplications } from "@/features/agency/queries";
import { resolveCountryReference } from "@/features/countries/queries";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);
    const url = new URL(request.url);
    const applications = await listAgencySignupApplications(supabase, url.searchParams.get("status") ?? "pending");
    return ok(applications);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const country = await resolveCountryReference(supabase, requireString(body.country, "country"));
    const email = requireString(body.email, "email").toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "email must be a valid email address");
    }

    const { data, error } = await supabase
      .from("agency_signup_applications")
      .insert({
        company_name: requireString(body.companyName, "companyName"),
        contact_name: optionalString(body.contactName),
        phone: optionalString(body.phone),
        email,
        country_code: country.countryCode,
        country_name: country.countryName,
        original_country_name: country.originalCountryName,
        website: optionalString(body.website),
        notes: optionalString(body.notes),
        status: "pending"
      })
      .select("id, company_name, email, country_code, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    return created(data);
  } catch (error) {
    return fail(error);
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

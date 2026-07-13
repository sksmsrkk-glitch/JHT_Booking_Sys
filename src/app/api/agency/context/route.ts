import { requireAgencyUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const actor = await requireAgencyUser(supabase);
    const { data, error } = await supabase
      .from("agency_accounts")
      .select("id, name, country_code, billing_currency, lifecycle_status")
      .eq("id", actor.agencyAccountId)
      .single();
    if (error) throw new HttpError(500, error.message);
    const { data: country, error: countryError } = data.country_code
      ? await supabase
          .from("country_references")
          .select("country_name, default_currency")
          .eq("country_code", data.country_code)
          .eq("status", "active")
          .maybeSingle()
      : { data: null, error: null };
    if (countryError) throw new HttpError(500, countryError.message);
    return ok({
      agencyAccountId: data.id,
      agencyName: data.name,
      countryCode: data.country_code,
      countryName: country?.country_name ?? data.country_code,
      billingCurrency: data.billing_currency ?? country?.default_currency ?? "KRW",
      agencyUserName: actor.name,
      agencyUserEmail: actor.email
    });
  } catch (error) {
    return fail(error);
  }
}

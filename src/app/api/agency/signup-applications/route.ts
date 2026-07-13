import { createHash } from "node:crypto";
import { created, fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
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
    const supabase = createRequestSupabaseClient(request);
    const body = await readJson<Record<string, unknown>>(request);
    const countryInput = optionalString(body.countryCode) ?? requireString(body.country, "country");
    const country = await resolveCountry(supabase, countryInput);
    if (!country.defaultCurrency) throw new HttpError(409, "Selected country does not have a default currency");
    const requestedBillingCurrency = normalizeCurrency(country.defaultCurrency);
    const submittedCurrency = optionalString(body.billingCurrency);
    if (submittedCurrency && normalizeCurrency(submittedCurrency) !== requestedBillingCurrency) {
      throw new HttpError(400, "billingCurrency must match the selected country master");
    }
    const email = requireString(body.email, "email").toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "email must be a valid email address");
    }
    const requestFingerprint = await enforceSignupRateLimit(request, email);

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
        requested_billing_currency: requestedBillingCurrency,
        website: optionalString(body.website),
        notes: optionalString(body.notes),
        request_fingerprint: requestFingerprint,
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

async function enforceSignupRateLimit(request: Request, email: string) {
  const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const secret = process.env.SIGNUP_RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local-only";
  const fingerprint = createHash("sha256").update(`${secret}:${clientAddress}`).digest("hex");
  const service = createServiceSupabaseClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [{ count, error: countError }, { data: duplicate, error: duplicateError }] = await Promise.all([
    service
      .from("agency_signup_applications")
      .select("id", { count: "exact", head: true })
      .eq("request_fingerprint", fingerprint)
      .gte("created_at", since),
    service
      .from("agency_signup_applications")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle()
  ]);

  if (countError || duplicateError) throw new HttpError(500, "Unable to validate sign-up application");
  if ((count ?? 0) >= 5) throw new HttpError(429, "Too many sign-up applications. Please try again later");
  if (duplicate) throw new HttpError(409, "A pending application already exists for this email");
  return fingerprint;
}

async function resolveCountry(supabase: any, countryInput: string) {
  try {
    return await resolveCountryReference(supabase, countryInput);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid country");
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeCurrency(value: string) {
  const normalized = value.trim().replace(/[^a-z]/gi, "").slice(0, 8).toUpperCase();
  if (!normalized) throw new HttpError(400, "billingCurrency is required");
  return normalized;
}

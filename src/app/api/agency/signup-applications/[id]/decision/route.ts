import { writeAuditLog } from "@/lib/api/audit";
import { provisionAgencyAuthUser, rollbackProvisionedAuthUser } from "@/lib/api/agency-auth-admin";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const applicationId = requireUuid(id, "id");
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const decision = requireString(body.decision, "decision");

    const { data: application, error: applicationError } = await supabase
      .from("agency_signup_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    if (applicationError) throw new HttpError(500, applicationError.message);
    if (!application) throw new HttpError(404, "Signup application not found");
    if (application.status !== "pending") throw new HttpError(409, "Signup application is already reviewed");

    const reviewedAt = new Date().toISOString();
    if (decision === "approve") {
      const result = await approveApplication(
        supabase,
        application,
        internalUser.profileId,
        reviewedAt,
        new URL("/agency/login", request.url).toString()
      );
      return ok(result);
    }

    if (decision === "reject") {
      const result = await rejectApplication(
        supabase,
        application,
        internalUser.profileId,
        optionalString(body.rejectionReason) ?? "Rejected by JHT admin",
        reviewedAt
      );
      return ok(result);
    }

    throw new HttpError(400, "decision must be approve or reject");
  } catch (error) {
    return fail(error);
  }
}

async function approveApplication(
  supabase: any,
  application: any,
  profileId: string,
  reviewedAt: string,
  loginRedirectTo: string
) {
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (companyError) throw new HttpError(500, companyError.message);
  if (!company) throw new HttpError(409, "A company record is required before approving partners");
  const billingCurrency = await resolveBillingCurrency(supabase, application);
  const authProvision = await provisionAgencyAuthUser({
    email: application.email,
    name: application.contact_name ?? `${application.company_name} Admin`,
    accountRole: "mother",
    redirectTo: loginRedirectTo
  });

  let agencyAccount: any = null;
  try {
    const { data, error: agencyError } = await supabase
      .from("agency_accounts")
      .insert({
        company_id: company.id,
        name: application.company_name,
        country_code: application.country_code,
        email_domain: domainFromEmail(application.email),
        phone: application.phone,
        website: application.website,
        billing_currency: billingCurrency,
        status: "active",
        lifecycle_status: "active",
        approved_at: reviewedAt
      })
      .select("id, name, country_code, lifecycle_status")
      .single();
    if (agencyError) throw new HttpError(500, agencyError.message);
    agencyAccount = data;

    const { data: agencyUser, error: userError } = await supabase
      .from("agency_users")
      .insert({
        agency_account_id: agencyAccount.id,
        auth_user_id: authProvision.authUserId,
        email: application.email,
        name: application.contact_name ?? `${application.company_name} Admin`,
        title: "Mother account",
        is_account_admin: true,
        account_role: "mother",
        password_reset_required: true,
        status: "active"
      })
      .select("id, auth_user_id, email, name, account_role, password_reset_required")
      .single();
    if (userError) throw new HttpError(500, userError.message);

    const { data: updatedApplication, error: updateError } = await supabase
      .from("agency_signup_applications")
      .update({
        status: "approved",
        reviewed_by: profileId,
        reviewed_at: reviewedAt,
        created_agency_account_id: agencyAccount.id,
        created_mother_agency_user_id: agencyUser.id,
        email_notification_status: authProvision.invitationSent ? "sent" : "existing_auth_user"
      })
      .eq("id", application.id)
      .select("id, status, created_agency_account_id, created_mother_agency_user_id")
      .single();
    if (updateError) throw new HttpError(500, updateError.message);

    await queueEmailEvent(supabase, {
      agencyAccountId: agencyAccount.id,
      agencyUserId: agencyUser.id,
      eventType: "signup_approved",
      recipientEmail: application.email,
      subject: "[JHT] Partner portal application approved",
      body:
        `Your JHT partner portal application has been approved.\n\n` +
        `Login ID: ${application.email}\n` +
        `Use the Supabase invitation email to set your password and sign in.`,
      deliveryStatus: authProvision.invitationSent ? "sent" : "not_required",
      sentAt: authProvision.invitationSent ? reviewedAt : null
    });

    await writeAuditLog(supabase, {
      actorProfileId: profileId,
      action: "agency_signup_application.approved",
      entityTable: "agency_signup_applications",
      entityId: application.id,
      afterData: { agencyAccount, agencyUser, updatedApplication, authProvision }
    });

    return updatedApplication;
  } catch (error) {
    if (agencyAccount?.id) await supabase.from("agency_accounts").delete().eq("id", agencyAccount.id);
    await rollbackProvisionedAuthUser(authProvision);
    throw error;
  }
}

async function rejectApplication(
  supabase: any,
  application: any,
  profileId: string,
  rejectionReason: string,
  reviewedAt: string
) {
  const { data, error } = await supabase
    .from("agency_signup_applications")
    .update({
      status: "rejected",
      reviewed_by: profileId,
      reviewed_at: reviewedAt,
      rejection_reason: rejectionReason,
      email_notification_status: "queued"
    })
    .eq("id", application.id)
    .select("id, status, rejection_reason")
    .single();
  if (error) throw new HttpError(500, error.message);

  await queueEmailEvent(supabase, {
    agencyAccountId: null,
    agencyUserId: null,
    eventType: "signup_rejected",
    recipientEmail: application.email,
    subject: "[JHT] Partner portal application update",
    body: `Your JHT partner portal application was not approved at this time.\n\nReason: ${rejectionReason}`
  });

  await writeAuditLog(supabase, {
    actorProfileId: profileId,
    action: "agency_signup_application.rejected",
    entityTable: "agency_signup_applications",
    entityId: application.id,
    afterData: data
  });

  return data;
}

async function queueEmailEvent(supabase: any, payload: Record<string, unknown>) {
  const { error } = await supabase.from("agency_account_email_events").insert({
    agency_account_id: payload.agencyAccountId,
    agency_user_id: payload.agencyUserId,
    event_type: payload.eventType,
    recipient_email: payload.recipientEmail,
    subject: payload.subject,
    body: payload.body,
    delivery_status: payload.deliveryStatus ?? "queued",
    sent_at: payload.sentAt ?? null
  });
  if (error) throw new HttpError(500, error.message);
}

async function resolveBillingCurrency(supabase: any, application: any) {
  const requested = optionalString(application.requested_billing_currency);
  if (requested) return normalizeCurrency(requested);

  if (application.country_code) {
    const { data, error } = await supabase
      .from("country_references")
      .select("default_currency")
      .eq("country_code", application.country_code)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (data?.default_currency) return normalizeCurrency(data.default_currency);
  }

  return "KRW";
}

function domainFromEmail(email: string) {
  const domain = email.split("@")[1];
  return domain ? domain.toLowerCase() : null;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeCurrency(value: string) {
  return value.trim().replace(/[^a-z]/gi, "").slice(0, 8).toUpperCase() || "KRW";
}

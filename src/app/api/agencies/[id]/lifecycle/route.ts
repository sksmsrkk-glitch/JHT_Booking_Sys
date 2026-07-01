import { writeAuditLog } from "@/lib/api/audit";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

const allowedLifecycleStatuses = ["active", "frozen", "withdrawn"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const agencyAccountId = requireUuid(id, "id");
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const lifecycleStatus = requireString(body.lifecycleStatus, "lifecycleStatus");
    if (!allowedLifecycleStatuses.includes(lifecycleStatus as any)) {
      throw new HttpError(400, "lifecycleStatus must be active, frozen, or withdrawn");
    }

    const now = new Date().toISOString();
    const status = lifecycleStatus === "active" ? "active" : "inactive";

    const { data: agency, error: updateError } = await supabase
      .from("agency_accounts")
      .update({
        lifecycle_status: lifecycleStatus,
        status,
        frozen_at: lifecycleStatus === "frozen" ? now : null,
        withdrawn_at: lifecycleStatus === "withdrawn" ? now : null
      })
      .eq("id", agencyAccountId)
      .select("id, name, lifecycle_status, status")
      .single();
    if (updateError) throw new HttpError(500, updateError.message);

    if (lifecycleStatus !== "active") {
      const { error: userError } = await supabase
        .from("agency_users")
        .update({ status: "inactive", forced_withdrawn_at: now })
        .eq("agency_account_id", agencyAccountId);
      if (userError) throw new HttpError(500, userError.message);
    }

    await queueLifecycleEmails(supabase, agencyAccountId, agency.name, lifecycleStatus);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: `agency_account.${lifecycleStatus}`,
      entityTable: "agency_accounts",
      entityId: agencyAccountId,
      afterData: agency
    });

    return ok(agency);
  } catch (error) {
    return fail(error);
  }
}

async function queueLifecycleEmails(supabase: any, agencyAccountId: string, agencyName: string, lifecycleStatus: string) {
  const { data: users, error } = await supabase
    .from("agency_users")
    .select("id, email")
    .eq("agency_account_id", agencyAccountId)
    .eq("is_account_admin", true);
  if (error) throw new HttpError(500, error.message);

  const events = (users ?? []).map((user: any) => ({
    agency_account_id: agencyAccountId,
    agency_user_id: user.id,
    event_type: `account_${lifecycleStatus}`,
    recipient_email: user.email,
    subject: `[JHT] Partner account ${lifecycleStatus}`,
    body: `JHT partner account "${agencyName}" status has changed to ${lifecycleStatus}.`,
    delivery_status: "queued"
  }));
  if (events.length === 0) return;

  const { error: insertError } = await supabase.from("agency_account_email_events").insert(events);
  if (insertError) throw new HttpError(500, insertError.message);
}

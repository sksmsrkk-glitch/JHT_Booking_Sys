import { fail, ok } from "@/lib/api/http";
import { requireAdminUser } from "@/lib/api/auth";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireAdminUser(supabase);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";
    let query = supabase
      .from("account_recovery_requests")
      .select(
        "id, recovery_type, account_type, submitted_email, company_name, contact_name, phone_last_four, result, status, resolution_note, resolved_at, created_at, agency_users(email, name)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;

    return ok(
      (data ?? []).map((row: any) => ({
        id: row.id,
        recoveryType: row.recovery_type,
        accountType: row.account_type,
        submittedEmail: row.submitted_email,
        companyName: row.company_name,
        contactName: row.contact_name,
        phoneLastFour: row.phone_last_four,
        matchedEmail: row.agency_users?.email ?? null,
        matchedName: row.agency_users?.name ?? null,
        result: row.result,
        status: row.status,
        resolutionNote: row.resolution_note,
        resolvedAt: row.resolved_at,
        createdAt: row.created_at
      }))
    );
  } catch (error) {
    return fail(error);
  }
}

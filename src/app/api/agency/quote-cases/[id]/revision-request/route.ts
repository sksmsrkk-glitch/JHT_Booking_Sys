import { writeAuditLog } from "@/lib/api/audit";
import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);

    const { data: quoteCase, error: quoteError } = await supabase
      .from("quote_cases")
      .select("id, agency_account_id, tour_name, status")
      .eq("id", id)
      .eq("agency_account_id", agencyUser.agencyAccountId)
      .maybeSingle();

    if (quoteError) throw new HttpError(500, quoteError.message);
    if (!quoteCase) throw new HttpError(404, "Quote case not found");

    const { data, error } = await supabase
      .from("agency_inquiries")
      .insert({
        agency_account_id: quoteCase.agency_account_id,
        submitted_by_agency_user_id: agencyUser.agencyUserId,
        inquiry_type: "revision_request",
        title: requireString(body.title, "title"),
        source_channel: "portal",
        related_quote_case_id: quoteCase.id,
        request_payload: {
          message: requireString(body.message, "message"),
          requested_changes: body.requestedChanges ?? []
        }
      })
      .select("id, inquiry_type, title, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    const { error: statusError } = await supabase
      .from("quote_cases")
      .update({ status: "revision_requested" })
      .eq("id", quoteCase.id);

    if (statusError) throw new HttpError(500, statusError.message);
    await writeAuditLog(supabase, {
      actorProfileId: null,
      action: "agency_quote.revision_requested",
      entityTable: "agency_inquiries",
      entityId: data.id,
      beforeData: { quoteCaseStatus: quoteCase.status ?? null },
      afterData: {
        agencyAccountId: agencyUser.agencyAccountId,
        agencyUserId: agencyUser.agencyUserId,
        quoteCaseId: quoteCase.id,
        quoteCaseStatus: "revision_requested",
        inquiry: data
      }
    });
    return created(data);
  } catch (error) {
    return fail(error);
  }
}

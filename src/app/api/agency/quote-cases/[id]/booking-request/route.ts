import { writeAuditLog } from "@/lib/api/audit";
import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);

    const { data: quoteCase, error: quoteError } = await supabase
      .from("quote_cases")
      .select("id, agency_account_id, tour_name, status")
      .eq("id", id)
      .eq("agency_account_id", agencyUser.agencyAccountId)
      .maybeSingle();

    if (quoteError) throw new HttpError(500, quoteError.message);
    if (!quoteCase) throw new HttpError(404, "Quote case not found");
    const requestedVersion = await resolveAgencyVisibleQuoteVersion(supabase, {
      quoteCaseId: quoteCase.id,
      quoteVersionId: typeof body.acceptedQuoteVersionId === "string" ? body.acceptedQuoteVersionId : null
    });

    const { data, error } = await supabase
      .from("agency_inquiries")
      .insert({
        agency_account_id: quoteCase.agency_account_id,
        submitted_by_agency_user_id: agencyUser.agencyUserId,
        inquiry_type: "booking_request",
        title: `Booking request: ${quoteCase.tour_name}`,
        source_channel: "portal",
        related_quote_case_id: quoteCase.id,
        request_payload: {
          message: requireString(body.message, "message"),
          requested_quote_version_id: requestedVersion.id,
          requested_quote_version_no: requestedVersion.version_no,
          requested_quote_version_status: requestedVersion.status,
          agency_reference_no: body.agencyReferenceNo ?? null
        }
      })
      .select("id, inquiry_type, title, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    await writeAuditLog(supabase, {
      actorProfileId: null,
      action: "agency_quote.booking_requested",
      entityTable: "agency_inquiries",
      entityId: data.id,
      afterData: {
        agencyAccountId: agencyUser.agencyAccountId,
        agencyUserId: agencyUser.agencyUserId,
        quoteCaseId: quoteCase.id,
        quoteVersionId: requestedVersion.id,
        inquiry: data
      }
    });
    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function resolveAgencyVisibleQuoteVersion(
  supabase: any,
  { quoteCaseId, quoteVersionId }: { quoteCaseId: string; quoteVersionId: string | null }
) {
  let query = supabase
    .from("quote_versions")
    .select("id, version_no, status")
    .eq("quote_case_id", quoteCaseId)
    .in("status", ["sent", "accepted"])
    .order("version_no", { ascending: false })
    .limit(1);

  if (quoteVersionId) {
    query = query.eq("id", quoteVersionId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) {
    throw new HttpError(409, "Booking request requires a sent or accepted quote version");
  }
  return data;
}

import { writeAuditLog } from "@/lib/api/audit";
import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, ok, optionalPositiveInteger, optionalString, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_INQUIRY_TYPES = [
  "new_inquiry",
  "revision_request",
  "booking_request",
  "change_request",
  "cancellation_request",
  "existing_product_inquiry"
];

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const { data, error } = await supabase
      .from("agency_inquiries")
      .select("id, inquiry_type, title, requested_start_date, requested_end_date, pax_count, tour_type, status, related_quote_case_id, created_at")
      .eq("agency_account_id", agencyUser.agencyAccountId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new HttpError(500, error.message);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const inquiryType = optionalString(body.inquiryType) ?? "new_inquiry";

    if (!ALLOWED_INQUIRY_TYPES.includes(inquiryType)) {
      throw new HttpError(400, "Unsupported inquiryType");
    }

    const { data, error } = await supabase
      .from("agency_inquiries")
      .insert({
        agency_account_id: agencyUser.agencyAccountId,
        submitted_by_agency_user_id: agencyUser.agencyUserId,
        inquiry_type: inquiryType,
        title: requireString(body.title, "title"),
        requested_start_date: optionalString(body.requestedStartDate),
        requested_end_date: optionalString(body.requestedEndDate),
        pax_count: optionalPositiveInteger(body.paxCount, "paxCount"),
        preferred_language: optionalString(body.preferredLanguage),
        tour_type: optionalString(body.tourType),
        source_channel: "portal",
        request_payload: body.requestPayload ?? {}
      })
      .select("id, inquiry_type, title, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    await writeAuditLog(supabase, {
      actorProfileId: null,
      action: "agency_inquiry.submitted",
      entityTable: "agency_inquiries",
      entityId: data.id,
      afterData: {
        agencyAccountId: agencyUser.agencyAccountId,
        agencyUserId: agencyUser.agencyUserId,
        inquiry: data
      }
    });
    return created(data);
  } catch (error) {
    return fail(error);
  }
}

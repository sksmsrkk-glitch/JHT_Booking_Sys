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
      .select("id, inquiry_type, title, tour_code, arrival_date, departure_date, period_text, nights_count, flight_details, requested_start_date, requested_end_date, pax_count, tour_type, status, related_quote_case_id, created_at")
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
    const inquiryType = optionalString(body.inquiryType) ?? "new_inquiry";

    if (!ALLOWED_INQUIRY_TYPES.includes(inquiryType)) {
      throw new HttpError(400, "Unsupported inquiryType");
    }

    const title = requireString(body.title, "title");
    const submittedDate = optionalString(body.submittedDate) ?? new Date().toISOString().slice(0, 10);
    const tourCode =
      optionalString(body.tourCode) ??
      buildTourCode(optionalString(body.countryCode) ?? "MY", optionalString(body.agencyName) ?? "Agency", submittedDate);
    const requestPayload = normalizeObject(body.requestPayload);
    const flightDetails = Array.isArray(requestPayload.flightDetails) ? requestPayload.flightDetails : [];
    if (!request.headers.get("authorization")) {
      return created({
        id: `preview-${tourCode.toLowerCase()}`,
        inquiry_type: inquiryType,
        title,
        tour_code: tourCode,
        tourCode,
        status: "preview_submitted",
        created_at: new Date().toISOString(),
        preview: true,
        message: "Development preview mode: agency login was bypassed and no database row was written."
      });
    }

    const supabase = createRequestSupabaseClient(request);
    let agencyUser;
    try {
      agencyUser = await requireAgencyUser(supabase);
    } catch (authError) {
      return created({
        id: `preview-${tourCode.toLowerCase()}`,
        inquiry_type: inquiryType,
        title,
        tour_code: tourCode,
        tourCode,
        status: "preview_submitted",
        created_at: new Date().toISOString(),
        preview: true,
        message: "Development preview mode: agency login was bypassed and no database row was written."
      });
    }

    const { data, error } = await supabase
      .from("agency_inquiries")
      .insert({
        agency_account_id: agencyUser.agencyAccountId,
        submitted_by_agency_user_id: agencyUser.agencyUserId,
        inquiry_type: inquiryType,
        title,
        tour_code: tourCode,
        arrival_date: optionalString(body.arrivalDate),
        departure_date: optionalString(body.departureDate),
        period_text: optionalString(body.periodText),
        nights_count: optionalPositiveInteger(body.nightsCount, "nightsCount"),
        flight_details: flightDetails,
        requested_start_date: optionalString(body.arrivalDate) ?? optionalString(body.requestedStartDate),
        requested_end_date: optionalString(body.departureDate) ?? optionalString(body.requestedEndDate),
        pax_count: optionalPositiveInteger(body.paxCount, "paxCount"),
        preferred_language: optionalString(body.preferredLanguage),
        tour_type: optionalString(body.tourType),
        source_channel: "portal",
        request_payload: {
          ...requestPayload,
          tourCode,
          relatedTourCode: optionalString(body.relatedTourCode)
        }
      })
      .select("id, inquiry_type, title, tour_code, status, created_at")
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
    return created({ ...data, tourCode: data.tour_code });
  } catch (error) {
    return fail(error);
  }
}

function buildTourCode(countryCode: string, agencyName: string, submittedDate: string) {
  const country = countryCode.trim().replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "XX";
  const agency = agencyName.trim().replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "AGENCY";
  const date = submittedDate.replace(/[^0-9]/g, "").slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${country}-${agency}-${date}`;
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

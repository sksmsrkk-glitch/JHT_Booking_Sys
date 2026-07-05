import { requireAgencyUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);

    const { data: quoteCase, error: caseError } = await supabase
      .from("quote_cases")
      .select("id, case_code, share_id, tour_name, tour_type, status, currency, estimated_pax, start_date, end_date, created_at")
      .eq("share_id", id)
      .eq("agency_account_id", agencyUser.agencyAccountId)
      .maybeSingle();

    if (caseError) throw new HttpError(500, caseError.message);
    if (!quoteCase) throw new HttpError(404, "Quote case not found");

    const { data: versions, error: versionError } = await supabase
      .from("quote_versions")
      .select("id, version_no, status, currency, exchange_rate_to_krw, agency_visible_summary, public_fare_options, public_total_amount, terms_and_conditions, sent_at, accepted_at, quote_itinerary_days(id, day_no, service_date, title, meal_summary, public_description, route_segments(id, seq, origin_label, destination_label, travel_minutes, distance_meters, provider)), quote_presentation_blocks(id, quote_itinerary_day_id, block_type, display_context, title, description, image_storage_path, image_url, alt_text, sort_order, metadata)")
      .eq("quote_case_id", quoteCase.id)
      .in("status", ["sent", "accepted", "superseded"])
      .order("version_no", { ascending: false });

    if (versionError) throw new HttpError(500, versionError.message);

    const { data: inquiries, error: inquiryError } = await supabase
      .from("agency_inquiries")
      .select("id, inquiry_type, title, status, request_payload, created_at")
      .eq("related_quote_case_id", quoteCase.id)
      .eq("agency_account_id", agencyUser.agencyAccountId)
      .order("created_at", { ascending: false });

    if (inquiryError) throw new HttpError(500, inquiryError.message);
    return ok({ ...quoteCase, versions: versions ?? [], request_timeline: inquiries ?? [] });
  } catch (error) {
    return fail(error);
  }
}

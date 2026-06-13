import { requireAgencyUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    await requireAgencyUser(supabase);

    const { data: quoteCase, error: caseError } = await supabase
      .from("quote_cases")
      .select("id, case_code, share_id, tour_name, tour_type, status, currency, estimated_pax, start_date, end_date, created_at")
      .eq("share_id", id)
      .maybeSingle();

    if (caseError) throw new HttpError(500, caseError.message);
    if (!quoteCase) throw new HttpError(404, "Quote case not found");

    const { data: versions, error: versionError } = await supabase
      .from("quote_versions")
      .select("id, version_no, status, currency, agency_visible_summary, public_total_amount, terms_and_conditions, sent_at, accepted_at, quote_itinerary_days(id, day_no, service_date, title, meal_summary, public_description, route_segments(id, seq, origin_label, destination_label, travel_minutes, distance_meters, provider))")
      .eq("quote_case_id", quoteCase.id)
      .order("version_no", { ascending: false });

    if (versionError) throw new HttpError(500, versionError.message);
    return ok({ ...quoteCase, versions: versions ?? [] });
  } catch (error) {
    return fail(error);
  }
}

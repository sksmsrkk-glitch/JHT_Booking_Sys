import { writeAuditLog } from "@/lib/api/audit";
import { requireAgencyUser } from "@/lib/api/auth";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { created, fail, HttpError, ok, optionalPositiveInteger, optionalString, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { ensureWorkflowThread, getWorkflowThreadByCode } from "@/features/workflow/queries";
import { makeWorkflowCode } from "@/lib/domain/workflow-code.mjs";

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
    const supabase = createRequestSupabaseClient(request);
    let agencyUser;
    try {
      agencyUser = await requireAgencyUser(supabase);
    } catch (authError) {
      if (!isDemoModeEnabled()) throw authError;
      const body = await readJson<Record<string, unknown>>(request);
      const title = requireString(body.title, "title");
      const previewCode = makeWorkflowCode({
        countryCode: optionalString(body.countryCode) ?? "MY",
        agencyName: optionalString(body.agencyName) ?? "Agency"
      });
      return created({
        id: `preview-${previewCode.toLowerCase()}`,
        inquiry_type: optionalString(body.inquiryType) ?? "new_inquiry",
        title,
        tour_code: previewCode,
        tourCode: previewCode,
        status: "preview_submitted",
        created_at: new Date().toISOString(),
        preview: true,
        message: "Development preview mode: no database row was written."
      });
    }

    const body = await readJson<Record<string, unknown>>(request);
    const inquiryType = optionalString(body.inquiryType) ?? "new_inquiry";
    if (!ALLOWED_INQUIRY_TYPES.includes(inquiryType)) throw new HttpError(400, "Unsupported inquiryType");
    const title = requireString(body.title, "title");
    const requestPayload = normalizeObject(body.requestPayload);
    const flightDetails = Array.isArray(requestPayload.flightDetails) ? requestPayload.flightDetails : [];
    const { data: agencyAccount, error: agencyError } = await supabase
      .from("agency_accounts")
      .select("id, name, country_code, billing_currency")
      .eq("id", agencyUser.agencyAccountId)
      .single();
    if (agencyError) throw new HttpError(500, agencyError.message);

    const relatedTourCode = optionalString(body.relatedTourCode);
    const startsNewWorkflow = ["new_inquiry", "existing_product_inquiry"].includes(inquiryType);
    if (!startsNewWorkflow && !relatedTourCode) throw new HttpError(400, "Related tour code is required for this inquiry type");
    if (relatedTourCode) await assertWorkflowBelongsToAgency(supabase, relatedTourCode, agencyUser.agencyAccountId);
    const tourCode = relatedTourCode ?? makeWorkflowCode({ countryCode: agencyAccount.country_code ?? "XX", agencyName: agencyAccount.name });

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
          relatedTourCode,
          countryCode: agencyAccount.country_code,
          countryName: requestPayload.countryName ?? null,
          agencyName: agencyAccount.name,
          billingCurrency: agencyAccount.billing_currency
        }
      })
      .select("id, inquiry_type, title, tour_code, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    const existingThread = await getWorkflowThreadByCode(supabase, tourCode);
    if (!existingThread) {
      await ensureWorkflowThread(supabase, {
        workflowCode: tourCode,
        title,
        agencyAccountId: agencyUser.agencyAccountId,
        agencyInquiryId: data.id,
        createdBy: null
      });
    }
    await appendInquiryMessage(supabase, {
      workflowCode: tourCode,
      agencyUser,
      inquiryId: data.id,
      inquiryType,
      title,
      body: buildInquiryMessage(body, requestPayload)
    });
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

async function assertWorkflowBelongsToAgency(supabase: any, workflowCode: string, agencyAccountId: string) {
  const { data, error } = await supabase
    .from("workflow_threads")
    .select("id")
    .eq("workflow_code", workflowCode)
    .eq("agency_account_id", agencyAccountId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Related tour code was not found for this partner account");
}

async function appendInquiryMessage(supabase: any, input: any) {
  const { data: thread, error: threadError } = await supabase
    .from("workflow_threads")
    .select("id")
    .eq("workflow_code", input.workflowCode)
    .single();
  if (threadError) throw new HttpError(500, threadError.message);
  const { data: message, error: messageError } = await supabase
    .from("workflow_messages")
    .insert({
      workflow_thread_id: thread.id,
      sender_type: "agency",
      sender_agency_user_id: input.agencyUser.agencyUserId,
      sender_name: input.agencyUser.name,
      sender_email: input.agencyUser.email,
      message_type: input.inquiryType === "new_inquiry" ? "new_inquiry" : input.inquiryType === "cancellation_request" ? "cancellation" : "quote_revision",
      body: input.body,
      visibility: "partner_visible",
      metadata: { agency_inquiry_id: input.inquiryId }
    })
    .select("created_at")
    .single();
  if (messageError) throw new HttpError(500, messageError.message);
  const { error: updateError } = await supabase
    .from("workflow_threads")
    .update({ status: "waiting_internal", last_message_at: message.created_at })
    .eq("id", thread.id);
  if (updateError) throw new HttpError(500, updateError.message);
}

function buildInquiryMessage(body: Record<string, unknown>, requestPayload: Record<string, unknown>) {
  const sections = [
    `Inquiry: ${requireString(body.title, "title")}`,
    optionalString(body.periodText) ? `Period: ${optionalString(body.periodText)}` : null,
    body.paxCount ? `Pax: ${body.paxCount}` : null,
    body.nightsCount ? `Nights: ${body.nightsCount}` : null,
    optionalString(requestPayload.itineraryText) ?? optionalString(body.notes) ?? null
  ];
  return sections.filter(Boolean).join("\n");
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteVersionId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const before = await getQuoteVersion(supabase, quoteVersionId);

    const update = {
      agency_visible_summary: normalizeObject(body.agencyVisibleSummary),
      public_fare_options: normalizeArray(body.publicFareOptions),
      excel_source_summary: normalizeObject(body.excelSourceSummary),
      terms_and_conditions: optionalString(body.termsAndConditions)
    };

    const { data, error } = await supabase
      .from("quote_versions")
      .update(update)
      .eq("id", quoteVersionId)
      .select("id, quote_case_id, version_no, agency_visible_summary, public_fare_options, excel_source_summary, terms_and_conditions")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_version.public_summary_updated",
      entityTable: "quote_versions",
      entityId: quoteVersionId,
      beforeData: before,
      afterData: data
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

async function getQuoteVersion(supabase: any, quoteVersionId: string) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, quote_case_id, version_no, status, agency_visible_summary, public_fare_options, excel_source_summary, terms_and_conditions")
    .eq("id", quoteVersionId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Quote version not found");
  if (!["draft", "review"].includes(data.status)) {
    throw new HttpError(409, `Public summary can only be edited while quote version is ${data.status}`);
  }
  return data;
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "publicFareOptions must be an array");
  }
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

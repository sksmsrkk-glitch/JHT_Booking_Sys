import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteVersionId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: version, error: versionError } = await supabase
      .from("quote_versions")
      .select("id, quote_case_id, version_no, status")
      .eq("id", quoteVersionId)
      .maybeSingle();

    if (versionError) throw new HttpError(500, versionError.message);
    if (!version) throw new HttpError(404, "Quote version not found");
    if (version.status !== "draft") {
      throw new HttpError(409, `Itinerary days can only be added to draft versions`);
    }

    const dayNo = optionalPositiveInteger(body.dayNo, "dayNo") ?? (await nextDayNo(supabase, quoteVersionId));
    const { data, error } = await supabase
      .from("quote_itinerary_days")
      .insert({
        quote_version_id: quoteVersionId,
        day_no: dayNo,
        service_date: optionalString(body.serviceDate),
        title: optionalString(body.title),
        meal_summary: parseMealSummary(body.mealSummary),
        public_description: requireString(body.publicDescription, "publicDescription"),
        internal_notes: optionalString(body.internalNotes)
      })
      .select("id, quote_version_id, day_no, service_date, title, public_description, internal_notes")
      .single();

    if (error) {
      if (error.message?.includes("duplicate key")) {
        throw new HttpError(409, "Itinerary day number already exists for this quote version");
      }
      throw new HttpError(500, error.message);
    }

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_itinerary_day.created",
      entityTable: "quote_itinerary_days",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function nextDayNo(supabase: any, quoteVersionId: string) {
  const { data, error } = await supabase
    .from("quote_itinerary_days")
    .select("day_no")
    .eq("quote_version_id", quoteVersionId)
    .order("day_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  return Number(data?.day_no ?? 0) + 1;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return value === undefined || value === null ? null : String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

function parseMealSummary(value: unknown) {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") throw new HttpError(400, "mealSummary must be an object");
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    return parsed;
  } catch {
    throw new HttpError(400, "mealSummary must be a JSON object");
  }
}

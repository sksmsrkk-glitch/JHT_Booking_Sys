/**
 * @file 한글 책임: `/api/quote-itinerary-days/[id]/route-segments` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const itineraryDayId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const day = await getEditableItineraryDay(supabase, itineraryDayId);
    const seq = optionalPositiveInteger(body.seq, "seq") ?? (await nextSeq(supabase, itineraryDayId));

    const { data, error } = await supabase
      .from("route_segments")
      .insert({
        quote_itinerary_day_id: itineraryDayId,
        seq,
        origin_label: requireString(body.originLabel, "originLabel"),
        destination_label: requireString(body.destinationLabel, "destinationLabel"),
        origin_place_id: optionalString(body.originPlaceId),
        destination_place_id: optionalString(body.destinationPlaceId),
        travel_minutes: optionalNonNegativeInteger(body.travelMinutes, "travelMinutes"),
        distance_meters: optionalNonNegativeInteger(body.distanceMeters, "distanceMeters"),
        provider: optionalString(body.provider) ?? "manual",
        provider_payload: parseProviderPayload(body.providerPayload),
        manual_override: optionalBoolean(body.manualOverride) ?? true
      })
      .select("id, quote_itinerary_day_id, seq, origin_label, destination_label, travel_minutes, distance_meters, provider, manual_override")
      .single();

    if (error) {
      if (error.message?.includes("duplicate key")) {
        throw new HttpError(409, "Route segment sequence already exists for this itinerary day");
      }
      throw new HttpError(500, error.message);
    }

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "route_segment.created",
      entityTable: "route_segments",
      entityId: data.id,
      afterData: { ...data, quoteVersionId: day.quote_version_id }
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function getEditableItineraryDay(supabase: any, itineraryDayId: string) {
  const { data: day, error: dayError } = await supabase
    .from("quote_itinerary_days")
    .select("id, quote_version_id")
    .eq("id", itineraryDayId)
    .maybeSingle();

  if (dayError) throw new HttpError(500, dayError.message);
  if (!day) throw new HttpError(404, "Itinerary day not found");

  const { data: version, error: versionError } = await supabase
    .from("quote_versions")
    .select("id, status")
    .eq("id", day.quote_version_id)
    .maybeSingle();

  if (versionError) throw new HttpError(500, versionError.message);
  if (!version) throw new HttpError(404, "Quote version not found");
  if (version.status !== "draft") {
    throw new HttpError(409, "Route segments can only be added to draft quote versions");
  }

  return day;
}

async function nextSeq(supabase: any, itineraryDayId: string) {
  const { data, error } = await supabase
    .from("route_segments")
    .select("seq")
    .eq("quote_itinerary_day_id", itineraryDayId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  return Number(data?.seq ?? 0) + 1;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return value === undefined || value === null ? null : String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return Boolean(value);
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new HttpError(400, `${field} must be a positive integer`);
  return parsed;
}

function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new HttpError(400, `${field} must be a non-negative integer`);
  return parsed;
}

function parseProviderPayload(value: unknown) {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") throw new HttpError(400, "providerPayload must be an object");
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw new HttpError(400, "providerPayload must be a JSON object");
  }
}

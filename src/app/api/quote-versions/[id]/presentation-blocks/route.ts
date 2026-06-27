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
    await assertEditableVersion(supabase, quoteVersionId);

    const row = {
      quote_version_id: quoteVersionId,
      quote_itinerary_day_id: optionalUuid(body.quoteItineraryDayId, "quoteItineraryDayId"),
      source_supplier_media_id: optionalUuid(body.sourceSupplierMediaId, "sourceSupplierMediaId"),
      block_type: optionalString(body.blockType) ?? "image",
      display_context: optionalString(body.displayContext) ?? "itinerary",
      title: optionalString(body.title),
      description: optionalString(body.description),
      image_storage_path: optionalString(body.imageStoragePath),
      image_url: optionalString(body.imageUrl),
      alt_text: optionalString(body.altText),
      sort_order: optionalPositiveInteger(body.sortOrder, "sortOrder") ?? 1,
      is_public: body.isPublic !== false,
      metadata: normalizeObject(body.metadata)
    };

    if (!row.title && !row.description && !row.image_storage_path && !row.image_url) {
      throw new HttpError(400, "Presentation block requires title, description, image storage path, or image URL");
    }

    const { data, error } = await supabase
      .from("quote_presentation_blocks")
      .insert(row)
      .select("id, quote_version_id, quote_itinerary_day_id, block_type, display_context, title, description, image_storage_path, image_url, alt_text, sort_order, is_public, metadata")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_presentation_block.created",
      entityTable: "quote_presentation_blocks",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertEditableVersion(supabase: any, quoteVersionId: string) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, status")
    .eq("id", quoteVersionId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Quote version not found");
  if (!["draft", "review"].includes(data.status)) {
    throw new HttpError(409, `Presentation blocks can only be edited while quote version is ${data.status}`);
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, field);
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

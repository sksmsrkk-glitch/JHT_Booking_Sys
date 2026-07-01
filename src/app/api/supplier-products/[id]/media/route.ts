import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type MediaInput = {
  storagePath?: unknown;
  imageUrl?: unknown;
  publicLabel?: unknown;
  altText?: unknown;
  sortOrder?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const productId = requireUuid(id, "id");
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);

    const mediaItems = normalizeMediaItems(body.mediaItems ?? body);
    if (mediaItems.length === 0) {
      throw new HttpError(400, "At least one image is required");
    }
    if (mediaItems.length > 10) {
      throw new HttpError(400, "A supplier item can have at most 10 images");
    }

    const { data: product, error: productError } = await supabase
      .from("supplier_products")
      .select("id, domestic_supplier_id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) throw new HttpError(500, productError.message);
    if (!product) throw new HttpError(404, "Supplier product not found");

    const { count, error: countError } = await supabase
      .from("supplier_media")
      .select("id", { count: "exact", head: true })
      .eq("supplier_product_id", productId)
      .eq("media_type", "image");

    if (countError) throw new HttpError(500, countError.message);
    const currentCount = count ?? 0;
    if (currentCount + mediaItems.length > 10) {
      throw new HttpError(400, `A supplier item can have at most 10 images. Current: ${currentCount}`);
    }

    const rows = mediaItems.map((item, index) => ({
      domestic_supplier_id: product.domestic_supplier_id,
      supplier_product_id: productId,
      media_type: "image",
      storage_path: item.storagePath,
      image_url: item.imageUrl,
      public_label: item.publicLabel,
      alt_text: item.altText,
      sort_order: item.sortOrder ?? currentCount + index + 1,
      is_public: true,
      metadata: {}
    }));

    const { data, error } = await supabase
      .from("supplier_media")
      .insert(rows)
      .select("id, supplier_product_id, media_type, storage_path, image_url, public_label, alt_text, sort_order, is_public");

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "supplier_media.created",
      entityTable: "supplier_media",
      entityId: productId,
      afterData: { supplierProductId: productId, mediaCount: data?.length ?? 0 }
    });

    return created(data ?? []);
  } catch (error) {
    return fail(error);
  }
}

function normalizeMediaItems(value: unknown) {
  const rawItems = Array.isArray(value) ? value : [value];
  return rawItems.map(normalizeMediaItem).filter((item) => item.storagePath || item.imageUrl);
}

function normalizeMediaItem(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "mediaItems must contain objects");
  }
  const item = value as MediaInput;
  const storagePath = optionalText(item.storagePath);
  const imageUrl = optionalText(item.imageUrl);
  if (!storagePath && !imageUrl) {
    return { storagePath: null, imageUrl: null, publicLabel: null, altText: null, sortOrder: null };
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new HttpError(400, "imageUrl must start with http:// or https://");
  }
  return {
    storagePath,
    imageUrl,
    publicLabel: optionalText(item.publicLabel),
    altText: optionalText(item.altText),
    sortOrder: optionalPositiveInteger(item.sortOrder, "sortOrder")
  };
}

function optionalText(value: unknown) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

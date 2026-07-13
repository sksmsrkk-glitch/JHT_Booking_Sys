import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

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

    const { data: product, error: productError } = await supabase
      .from("supplier_products")
      .select("id, domestic_supplier_id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) throw new HttpError(500, productError.message);
    if (!product) throw new HttpError(404, "Supplier product not found");

    const { mediaItems, uploadedPaths } = await readMediaInput(request, product.domestic_supplier_id, productId);
    if (mediaItems.length === 0) throw new HttpError(400, "At least one image is required");
    if (mediaItems.length > 10) throw new HttpError(400, "A supplier item can have at most 10 images");

    const { count, error: countError } = await supabase
      .from("supplier_media")
      .select("id", { count: "exact", head: true })
      .eq("supplier_product_id", productId)
      .eq("media_type", "image");

    if (countError) {
      await removeUploadedFiles(uploadedPaths);
      throw new HttpError(500, countError.message);
    }
    const currentCount = count ?? 0;
    if (currentCount + mediaItems.length > 10) {
      await removeUploadedFiles(uploadedPaths);
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

    if (error) {
      await removeUploadedFiles(uploadedPaths);
      throw new HttpError(500, error.message);
    }

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

async function readMediaInput(request: Request, supplierId: string, productId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await readJson<Record<string, unknown>>(request);
    return { mediaItems: normalizeMediaItems(body.mediaItems ?? body), uploadedPaths: [] as string[] };
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 80 * 1024 * 1024) throw new HttpError(413, "Image upload is too large");
  const formData = await request.formData();
  const metadata = parseMediaMetadata(formData.get("mediaItems"));
  const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (metadata.length + files.length > 10) throw new HttpError(400, "A supplier item can have at most 10 images");

  const bucket = process.env.SUPPLIER_MEDIA_STORAGE_BUCKET || "supplier-media";
  const service = createServiceSupabaseClient();
  const uploadedPaths: string[] = [];
  const metadataCount = metadata.length;
  try {
    for (const [index, file] of files.entries()) {
      validateImageFile(file);
      const storagePath = `${supplierId}/${productId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error } = await service.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false
      });
      if (error) throw new HttpError(500, "Image upload failed");
      uploadedPaths.push(storagePath);
      metadata.push({
        storagePath,
        imageUrl: null,
        publicLabel: null,
        altText: file.name,
        sortOrder: metadataCount + index + 1
      });
    }
    return { mediaItems: metadata, uploadedPaths };
  } catch (error) {
    await removeUploadedFiles(uploadedPaths);
    throw error;
  }
}

function parseMediaMetadata(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return normalizeMediaItems(JSON.parse(value));
  } catch {
    throw new HttpError(400, "mediaItems must be valid JSON");
  }
}

function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) throw new HttpError(400, `${file.name} is not an image`);
  if (file.size > 8 * 1024 * 1024) throw new HttpError(413, `${file.name} exceeds the 8 MB limit`);
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, "-").slice(-120) || "image";
}

async function removeUploadedFiles(paths: string[]) {
  if (paths.length === 0) return;
  const bucket = process.env.SUPPLIER_MEDIA_STORAGE_BUCKET || "supplier-media";
  await createServiceSupabaseClient().storage.from(bucket).remove(paths);
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

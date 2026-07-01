import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { SUPPLIER_CATEGORIES, SUPPLIER_PRODUCT_TYPES, PRICING_UNITS } from "@/features/supplier/queries";
import { clean, mediaItemsFromSupplierExcelRow, parseSupplierWorkbook } from "@/lib/domain/supplier-excel.mjs";

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const formData = await request.formData();
    const companyId = requireUuid(formData.get("companyId"), "companyId");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "Excel file is required");
    }

    const rows = parseSupplierWorkbook(await file.arrayBuffer());
    if (rows.length === 0) throw new HttpError(400, "Excel file has no supplier rows");

    const supplierCache = new Map<string, string>();
    const productCache = new Map<string, string>();
    const mediaCache = new Map<string, Set<string>>();
    let supplierCount = 0;
    let productCount = 0;
    let priceCount = 0;
    let mediaCount = 0;

    for (const [index, row] of rows.entries()) {
      const rowNo = index + 1;
      const category = normalizeEnum(row.supplierCategory, SUPPLIER_CATEGORIES, "hotel");
      const supplierName = requiredCell(row.supplierNameKo, `row ${rowNo} supplierNameKo`);
      const supplierId = await findOrCreateSupplier(supabase, {
        cache: supplierCache,
        companyId,
        category,
        nameKo: supplierName,
        nameEn: clean(row.supplierNameEn),
        searchKeywords: clean(row.supplierKeywords),
        regionLevel1: clean(row.regionLevel1),
        regionLevel2: clean(row.regionLevel2),
        address: clean(row.address),
        phone: clean(row.phone),
        website: clean(row.website),
        internalNotes: clean(row.supplierNotes)
      });
      if (!supplierCache.get(`created:${supplierId}`)) {
        supplierCache.set(`created:${supplierId}`, "1");
        supplierCount += 1;
      }

      const itemName = clean(row.itemNameKo);
      if (!itemName) continue;

      const productType = normalizeEnum(row.productType, SUPPLIER_PRODUCT_TYPES, "other");
      const productId = await findOrCreateProduct(supabase, {
        cache: productCache,
        supplierId,
        productType,
        nameKo: itemName,
        nameEn: clean(row.itemNameEn),
        searchName: clean(row.searchName) || itemName,
        description: clean(row.description),
        capacity: optionalInteger(row.capacity, "capacity"),
        roomType: clean(row.roomType),
        breakfastIncluded: optionalBoolean(row.breakfastIncluded),
        vehicleSeatCount: optionalInteger(row.vehicleSeatCount, "vehicleSeatCount"),
        menuTags: splitTags(row.menuTags)
      });
      if (!productCache.get(`created:${productId}`)) {
        productCache.set(`created:${productId}`, "1");
        productCount += 1;
      }

      if (clean(row.costAmount)) {
        await insertPrice(supabase, productId, row);
        priceCount += 1;
      }

      const insertedMedia = await insertMedia(supabase, productId, supplierId, row, mediaCache);
      mediaCount += insertedMedia;
    }

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "domestic_suppliers.import_xlsx",
      entityTable: "domestic_suppliers",
      entityId: companyId,
      afterData: { rows: rows.length, supplierCount, productCount, priceCount, mediaCount }
    });

    return created({ rows: rows.length, supplierCount, productCount, priceCount, mediaCount });
  } catch (error) {
    return fail(error);
  }
}

async function findOrCreateSupplier(supabase: any, input: any) {
  const key = [input.companyId, input.category, input.nameKo].join("|");
  if (input.cache.has(key)) return input.cache.get(key);
  const { data: existing, error: findError } = await supabase
    .from("domestic_suppliers")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("category", input.category)
    .eq("name_ko", input.nameKo)
    .maybeSingle();
  if (findError) throw new HttpError(500, findError.message);
  if (existing) {
    input.cache.set(key, existing.id);
    return existing.id;
  }
  const { data, error } = await supabase
    .from("domestic_suppliers")
    .insert({
      company_id: input.companyId,
      category: input.category,
      name_ko: input.nameKo,
      name_en: input.nameEn || null,
      search_keywords: input.searchKeywords || null,
      region_level1: input.regionLevel1 || null,
      region_level2: input.regionLevel2 || null,
      address: input.address || null,
      phone: input.phone || null,
      website: input.website || null,
      internal_notes: input.internalNotes || null,
      status: "active"
    })
    .select("id")
    .single();
  if (error) throw new HttpError(500, error.message);
  input.cache.set(key, data.id);
  return data.id;
}

async function findOrCreateProduct(supabase: any, input: any) {
  const key = [input.supplierId, input.productType, input.nameKo, input.searchName].join("|");
  if (input.cache.has(key)) return input.cache.get(key);
  const { data: existing, error: findError } = await supabase
    .from("supplier_products")
    .select("id")
    .eq("domestic_supplier_id", input.supplierId)
    .eq("product_type", input.productType)
    .eq("name_ko", input.nameKo)
    .eq("search_name", input.searchName)
    .maybeSingle();
  if (findError) throw new HttpError(500, findError.message);
  if (existing) {
    input.cache.set(key, existing.id);
    return existing.id;
  }
  const { data, error } = await supabase
    .from("supplier_products")
    .insert({
      domestic_supplier_id: input.supplierId,
      product_type: input.productType,
      name_ko: input.nameKo,
      name_en: input.nameEn || null,
      search_name: input.searchName,
      description: input.description || null,
      capacity: input.capacity,
      room_type: input.roomType || null,
      breakfast_included: input.breakfastIncluded,
      vehicle_seat_count: input.vehicleSeatCount,
      menu_tags: input.menuTags,
      status: "active"
    })
    .select("id")
    .single();
  if (error) throw new HttpError(500, error.message);
  input.cache.set(key, data.id);
  return data.id;
}

async function insertPrice(supabase: any, productId: string, row: Record<string, unknown>) {
  const minPax = optionalInteger(row.minPax, "minPax");
  const maxPax = optionalInteger(row.maxPax, "maxPax");
  if (minPax !== null && maxPax !== null && maxPax < minPax) {
    throw new HttpError(400, "maxPax must be greater than or equal to minPax");
  }
  const { error } = await supabase.from("supplier_prices").insert({
    supplier_product_id: productId,
    pricing_unit: normalizeEnum(row.pricingUnit, PRICING_UNITS, "per_person"),
    currency: clean(row.currency) || "KRW",
    cost_amount: requiredNumber(row.costAmount, "costAmount"),
    min_pax: minPax,
    max_pax: maxPax,
    season_label: clean(row.seasonLabel) || null,
    valid_from: clean(row.validFrom) || null,
    valid_to: clean(row.validTo) || null,
    weekday_rule: clean(row.weekdayRule) || null,
    includes_tax: optionalBoolean(row.includesTax) ?? true,
    notes: clean(row.priceNotes) || null,
    status: "active"
  });
  if (error) throw new HttpError(500, error.message);
}

async function insertMedia(supabase: any, productId: string, supplierId: string, row: Record<string, unknown>, mediaCache: Map<string, Set<string>>) {
  const mediaItems = mediaItemsFromSupplierExcelRow(row);
  if (mediaItems.length === 0) return 0;

  if (!mediaCache.has(productId)) {
    const { data, error } = await supabase
      .from("supplier_media")
      .select("storage_path, image_url")
      .eq("supplier_product_id", productId)
      .eq("media_type", "image");
    if (error) throw new HttpError(500, error.message);
    mediaCache.set(
      productId,
      new Set((data ?? []).map((item: any) => mediaKey(item.storage_path, item.image_url)))
    );
  }

  const existing = mediaCache.get(productId)!;
  if (existing.size >= 10) return 0;
  const rows = [];
  for (const item of mediaItems) {
    const key = mediaKey(item.storagePath, item.imageUrl);
    if (existing.has(key)) continue;
    if (existing.size + rows.length >= 10) break;
    rows.push({
      domestic_supplier_id: supplierId,
      supplier_product_id: productId,
      media_type: "image",
      storage_path: item.storagePath || null,
      image_url: item.imageUrl || null,
      public_label: item.publicLabel || null,
      alt_text: item.altText || null,
      sort_order: item.sortOrder,
      is_public: true,
      metadata: {}
    });
    existing.add(key);
  }
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("supplier_media").insert(rows);
  if (error) throw new HttpError(500, error.message);
  return rows.length;
}

function requiredCell(value: unknown, field: string) {
  const normalized = clean(value);
  if (!normalized) throw new HttpError(400, `${field} is required`);
  return normalized;
}

function requiredNumber(value: unknown, field: string) {
  const parsed = Number(clean(value));
  if (!Number.isFinite(parsed) || parsed < 0) throw new HttpError(400, `${field} must be a non-negative number`);
  return parsed;
}

function optionalInteger(value: unknown, field: string) {
  const normalized = clean(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) throw new HttpError(400, `${field} must be a non-negative integer`);
  return parsed;
}

function optionalBoolean(value: unknown) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return null;
  return ["true", "yes", "y", "1", "included"].includes(normalized);
}

function normalizeEnum(value: unknown, allowed: readonly string[], fallback: string) {
  const normalized = clean(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function splitTags(value: unknown) {
  const tags = clean(value).split(",").map((tag) => tag.trim()).filter(Boolean);
  return tags.length > 0 ? tags : null;
}

function mediaKey(storagePath: string | null | undefined, imageUrl: string | null | undefined) {
  return `${storagePath ?? ""}|${imageUrl ?? ""}`;
}

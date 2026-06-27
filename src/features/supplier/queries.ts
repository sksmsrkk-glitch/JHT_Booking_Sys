import type {
  RecordStatus,
  SupplierCategory,
  SupplierDetail,
  SupplierListFilters,
  SupplierListItem
} from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const SUPPLIER_CATEGORIES: SupplierCategory[] = [
  "hotel",
  "vehicle",
  "restaurant",
  "attraction",
  "guide",
  "shopping",
  "local_government",
  "tourism_board",
  "other"
];

export const RECORD_STATUSES: RecordStatus[] = ["active", "inactive", "archived"];

export const SUPPLIER_PRODUCT_TYPES = [
  "room",
  "vehicle",
  "meal",
  "ticket",
  "guide_service",
  "meeting_room",
  "shopping_commission",
  "other"
];

export const PRICING_UNITS = ["per_person", "per_group", "per_room", "per_vehicle", "per_guide", "per_day"];

export async function listDomesticSuppliers(
  supabase: SupabaseClientLike,
  filters: SupplierListFilters = {}
) {
  const q = normalizeSearchTerm(filters.q);
  const category = normalizeEnum(filters.category, SUPPLIER_CATEGORIES);
  const status = normalizeEnum(filters.status, RECORD_STATUSES) ?? "active";

  let query = supabase
    .from("domestic_suppliers")
    .select(
      "id, category, name_ko, name_en, region_level1, region_level2, phone, website, status, updated_at, supplier_contacts(id), supplier_products(id)"
    )
    .eq("status", status)
    .limit(100);

  if (category) {
    query = query.eq("category", category);
  }

  if (q) {
    query = query.or(
      `name_ko.ilike.%${q}%,name_en.ilike.%${q}%,search_keywords.ilike.%${q}%,region_level1.ilike.%${q}%,region_level2.ilike.%${q}%`
    );
  }

  const { data, error } = await query.order("name_ko", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapSupplierListItem);
}

export async function getDomesticSupplierDetail(
  supabase: SupabaseClientLike,
  supplierId: string
): Promise<SupplierDetail | null> {
  const { data, error } = await supabase
    .from("domestic_suppliers")
    .select(
      "id, category, name_ko, name_en, region_level1, region_level2, address, google_place_id, naver_map_url, latitude, longitude, phone, website, status, internal_notes, updated_at, supplier_contacts(id, name, title, email, phone, kakao_available, receives_booking_messages, notes, status), supplier_products(id, product_type, name_ko, name_en, search_name, description, capacity, room_type, breakfast_included, vehicle_seat_count, menu_tags, status, supplier_prices(id, pricing_unit, currency, cost_amount, min_pax, max_pax, season_label, valid_from, valid_to, weekday_rule, includes_tax, status))"
    )
    .eq("id", supplierId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const listItem = mapSupplierListItem(data);
  return {
    ...listItem,
    address: data.address ?? null,
    googlePlaceId: data.google_place_id ?? null,
    naverMapUrl: data.naver_map_url ?? null,
    latitude: numericOrNull(data.latitude),
    longitude: numericOrNull(data.longitude),
    internalNotes: data.internal_notes ?? null,
    contacts: (data.supplier_contacts ?? []).map((contact: any) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      kakaoAvailable: Boolean(contact.kakao_available),
      receivesBookingMessages: Boolean(contact.receives_booking_messages),
      notes: contact.notes ?? null,
      status: contact.status
    })),
    products: (data.supplier_products ?? []).map((product: any) => ({
      id: product.id,
      productType: product.product_type,
      nameKo: product.name_ko,
      nameEn: product.name_en ?? null,
      searchName: product.search_name,
      description: product.description ?? null,
      capacity: product.capacity ?? null,
      roomType: product.room_type ?? null,
      breakfastIncluded: product.breakfast_included ?? null,
      vehicleSeatCount: product.vehicle_seat_count ?? null,
      menuTags: product.menu_tags ?? null,
      status: product.status,
      prices: (product.supplier_prices ?? []).map((price: any) => ({
        id: price.id,
        pricingUnit: price.pricing_unit,
        currency: price.currency,
        costAmount: Number(price.cost_amount),
        minPax: price.min_pax ?? null,
        maxPax: price.max_pax ?? null,
        seasonLabel: price.season_label ?? null,
        validFrom: price.valid_from ?? null,
        validTo: price.valid_to ?? null,
        weekdayRule: price.weekday_rule ?? null,
        includesTax: Boolean(price.includes_tax),
        status: price.status
      }))
    }))
  };
}

function mapSupplierListItem(row: any): SupplierListItem {
  return {
    id: row.id,
    category: row.category,
    nameKo: row.name_ko,
    nameEn: row.name_en ?? null,
    regionLevel1: row.region_level1 ?? null,
    regionLevel2: row.region_level2 ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    status: row.status,
    contactCount: Array.isArray(row.supplier_contacts) ? row.supplier_contacts.length : 0,
    productCount: Array.isArray(row.supplier_products) ? row.supplier_products.length : 0,
    updatedAt: row.updated_at
  };
}

function normalizeSearchTerm(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

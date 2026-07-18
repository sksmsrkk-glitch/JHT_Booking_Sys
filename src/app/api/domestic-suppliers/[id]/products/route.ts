/**
 * @file 한글 책임: `/api/domestic-suppliers/[id]/products` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { SUPPLIER_PRODUCT_TYPES } from "@/features/supplier/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supplierId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const productType = requireString(body.productType, "productType");

    if (!SUPPLIER_PRODUCT_TYPES.includes(productType)) {
      throw new HttpError(400, "Invalid supplier product type");
    }

    const { data: supplier, error: supplierError } = await supabase
      .from("domestic_suppliers")
      .select("id")
      .eq("id", supplierId)
      .maybeSingle();

    if (supplierError) throw new HttpError(500, supplierError.message);
    if (!supplier) throw new HttpError(404, "Domestic supplier not found");

    const nameKo = requireString(body.nameKo, "nameKo");
    const { data, error } = await supabase
      .from("supplier_products")
      .insert({
        domestic_supplier_id: supplierId,
        product_type: productType,
        name_ko: nameKo,
        name_en: optionalString(body.nameEn),
        search_name: optionalString(body.searchName) ?? nameKo,
        description: optionalString(body.description),
        capacity: optionalNonNegativeInteger(body.capacity, "capacity"),
        room_type: optionalString(body.roomType),
        breakfast_included: optionalBoolean(body.breakfastIncluded),
        vehicle_seat_count: optionalPositiveInteger(body.vehicleSeatCount, "vehicleSeatCount"),
        menu_tags: optionalStringArray(body.menuTags),
        status: "active"
      })
      .select("id, domestic_supplier_id, product_type, name_ko, search_name, status")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "supplier_product.created",
      entityTable: "supplier_products",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return Boolean(value);
}

function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new HttpError(400, `${field} must be a non-negative integer`);
  return parsed;
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new HttpError(400, `${field} must be a positive integer`);
  return parsed;
}

function optionalStringArray(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    const values = value.map((item) => String(item).trim()).filter(Boolean);
    return values.length > 0 ? values : null;
  }
  if (typeof value === "string") {
    const values = value.split(",").map((item) => item.trim()).filter(Boolean);
    return values.length > 0 ? values : null;
  }
  return null;
}

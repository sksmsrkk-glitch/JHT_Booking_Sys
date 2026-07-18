/**
 * @file 한글 책임: `/api/supplier-products/[id]/prices` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { PRICING_UNITS } from "@/features/supplier/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const productId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const pricingUnit = requireString(body.pricingUnit, "pricingUnit");

    if (!PRICING_UNITS.includes(pricingUnit)) {
      throw new HttpError(400, "Invalid pricing unit");
    }

    const { data: product, error: productError } = await supabase
      .from("supplier_products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) throw new HttpError(500, productError.message);
    if (!product) throw new HttpError(404, "Supplier product not found");

    const costAmount = requireNonNegativeNumber(body.costAmount, "costAmount");
    const minPax = optionalPositiveInteger(body.minPax, "minPax");
    const maxPax = optionalPositiveInteger(body.maxPax, "maxPax");
    if (minPax !== null && maxPax !== null && maxPax < minPax) {
      throw new HttpError(400, "maxPax must be greater than or equal to minPax");
    }

    const { data, error } = await supabase
      .from("supplier_prices")
      .insert({
        supplier_product_id: productId,
        pricing_unit: pricingUnit,
        currency: optionalString(body.currency) ?? "KRW",
        cost_amount: costAmount,
        staff_discount_amount: optionalNonNegativeNumber(body.staffDiscountAmount, "staffDiscountAmount"),
        min_pax: minPax,
        max_pax: maxPax,
        season_label: optionalString(body.seasonLabel),
        valid_from: optionalString(body.validFrom),
        valid_to: optionalString(body.validTo),
        weekday_rule: optionalString(body.weekdayRule),
        includes_tax: optionalBoolean(body.includesTax) ?? true,
        notes: optionalString(body.notes),
        status: "active"
      })
      .select("id, supplier_product_id, pricing_unit, currency, cost_amount, status")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "supplier_price.created",
      entityTable: "supplier_prices",
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

function requireNonNegativeNumber(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new HttpError(400, `${field} must be a non-negative number`);
  return parsed;
}

function optionalNonNegativeNumber(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireNonNegativeNumber(value, field);
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new HttpError(400, `${field} must be a positive integer`);
  return parsed;
}

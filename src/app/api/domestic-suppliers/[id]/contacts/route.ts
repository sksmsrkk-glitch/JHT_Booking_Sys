/**
 * @file 한글 책임: `/api/domestic-suppliers/[id]/contacts` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
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
    const supplierId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: supplier, error: supplierError } = await supabase
      .from("domestic_suppliers")
      .select("id")
      .eq("id", supplierId)
      .maybeSingle();

    if (supplierError) throw new HttpError(500, supplierError.message);
    if (!supplier) throw new HttpError(404, "Domestic supplier not found");

    const { data, error } = await supabase
      .from("supplier_contacts")
      .insert({
        domestic_supplier_id: supplierId,
        name: requireString(body.name, "name"),
        title: optionalString(body.title),
        email: optionalString(body.email),
        phone: optionalString(body.phone),
        kakao_available: optionalBoolean(body.kakaoAvailable) ?? false,
        receives_booking_messages: optionalBoolean(body.receivesBookingMessages) ?? true,
        notes: optionalString(body.notes),
        status: "active"
      })
      .select("id, domestic_supplier_id, name, email, phone, receives_booking_messages, status")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "supplier_contact.created",
      entityTable: "supplier_contacts",
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

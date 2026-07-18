/**
 * @file 한글 책임: `/api/supplier-messages/draft` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import {
  assertSupplierMessageDraftAllowed,
  buildDefaultSupplierMessageTemplate,
  buildSupplierMessageDraft
} from "@/lib/domain/supplier-messages.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const templateId = typeof body.templateId === "string" ? body.templateId : null;
    let subjectTemplate = typeof body.subjectTemplate === "string" ? body.subjectTemplate : "";
    let bodyTemplate = typeof body.bodyTemplate === "string" ? body.bodyTemplate : "";

    if (templateId) {
      const { data: template, error: templateError } = await supabase
        .from("supplier_message_templates")
        .select("id, subject_template, body_template")
        .eq("id", templateId)
        .eq("active", true)
        .single();

      if (templateError) throw new HttpError(500, templateError.message);
      subjectTemplate = template.subject_template ?? subjectTemplate;
      bodyTemplate = template.body_template ?? bodyTemplate;
    }

    if (!bodyTemplate) {
      bodyTemplate = requireString(body.body, "body");
    }

    const domesticSupplierId = requireUuid(body.domesticSupplierId, "domesticSupplierId");
    const supplierContactId = typeof body.supplierContactId === "string" && body.supplierContactId ? body.supplierContactId : null;
    if (supplierContactId) {
      await assertSupplierContactBelongsToSupplier(supabase, supplierContactId, domesticSupplierId);
    }

    const reservationId = requireUuid(body.reservationId, "reservationId");
    const messageType = requireString(body.messageType, "messageType");
    const channel = requireString(body.channel, "channel");
    const templateData = await buildTemplateData(supabase, reservationId, domesticSupplierId, body.data ?? {});
    if (!subjectTemplate || !bodyTemplate) {
      const fallback = buildDefaultSupplierMessageTemplate({ messageType, data: templateData });
      subjectTemplate = subjectTemplate || fallback.subjectTemplate;
      bodyTemplate = bodyTemplate || fallback.bodyTemplate;
    }

    const draft = buildSupplierMessageDraft({
      reservationId,
      domesticSupplierId,
      supplierContactId,
      messageType,
      channel,
      subjectTemplate,
      bodyTemplate,
      data: templateData,
      revisionNo: body.revisionNo ?? 1
    });

    // 같은 멱등키에 이미 승인/발송 단계로 넘어간 메시지가 있으면 덮어쓰지 않습니다.
    // (revisionNo를 올리지 않고 재초안하면 sent 메시지가 draft로 되돌아가 재발송되던 결함 차단)
    const { data: existing, error: existingError } = await supabase
      .from("supplier_message_outbox")
      .select("id, status")
      .eq("idempotency_key", draft.idempotency_key)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existing && !["draft", "failed"].includes(existing.status)) {
      throw new HttpError(
        409,
        `A supplier message with this key is already ${existing.status}. Increase the revision number to draft a new one.`
      );
    }

    const { data, error } = await supabase
      .from("supplier_message_outbox")
      .upsert(
        {
          ...draft,
          template_id: templateId,
          created_by: internalUser.profileId,
          metadata: { source: "draft_api", revision_no: body.revisionNo ?? 1 }
        },
        { onConflict: "idempotency_key" }
      )
      .select("id, reservation_id, domestic_supplier_id, message_type, channel, risk_level, status, subject, body, idempotency_key, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "supplier_message.drafted",
      entityTable: "supplier_message_outbox",
      entityId: data.id,
      riskLevel: data.risk_level,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertSupplierContactBelongsToSupplier(
  supabase: any,
  supplierContactId: string,
  domesticSupplierId: string
) {
  const { data, error } = await supabase
    .from("supplier_contacts")
    .select("id, domestic_supplier_id, status")
    .eq("id", requireUuid(supplierContactId, "supplierContactId"))
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Supplier contact not found");
  if (data.domestic_supplier_id !== domesticSupplierId) {
    throw new HttpError(400, "Supplier contact does not belong to the selected supplier");
  }
  if (data.status !== "active") throw new HttpError(409, "Supplier contact is not active");
}

async function buildTemplateData(
  supabase: any,
  reservationId: string,
  domesticSupplierId: string,
  inputData: unknown
) {
  const data = inputData && typeof inputData === "object" && !Array.isArray(inputData) ? inputData as any : {};
  const [{ data: reservation, error: reservationError }, { data: supplier, error: supplierError }] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, status, reservation_code, tour_start_date, tour_end_date, agency_accounts(name), quote_cases(tour_name)")
      .eq("id", reservationId)
      .maybeSingle(),
    supabase
      .from("domestic_suppliers")
      .select("id, name_ko")
      .eq("id", domesticSupplierId)
      .maybeSingle()
  ]);

  if (reservationError) throw new HttpError(500, reservationError.message);
  if (supplierError) throw new HttpError(500, supplierError.message);
  if (!reservation) throw new HttpError(404, "Reservation not found");
  if (!supplier) throw new HttpError(404, "Domestic supplier not found");
  try {
    assertSupplierMessageDraftAllowed({ reservationStatus: reservation.status });
  } catch (error) {
    throw new HttpError(409, error instanceof Error ? error.message : "Supplier message drafts are locked");
  }

  return {
    ...data,
    reservation: {
      ...(data.reservation ?? {}),
      code: data.reservation?.code ?? reservation.reservation_code,
      tourName: data.reservation?.tourName ?? reservation.quote_cases?.tour_name ?? null,
      startDate: data.reservation?.startDate ?? reservation.tour_start_date ?? null,
      endDate: data.reservation?.endDate ?? reservation.tour_end_date ?? null
    },
    agency: {
      ...(data.agency ?? {}),
      name: data.agency?.name ?? reservation.agency_accounts?.name ?? null
    },
    supplier: {
      ...(data.supplier ?? {}),
      name: data.supplier?.name ?? supplier.name_ko
    }
  };
}

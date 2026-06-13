import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { buildSupplierMessageDraft } from "@/lib/domain/supplier-messages.mjs";
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

    const draft = buildSupplierMessageDraft({
      reservationId: requireUuid(body.reservationId, "reservationId"),
      domesticSupplierId: requireUuid(body.domesticSupplierId, "domesticSupplierId"),
      supplierContactId: typeof body.supplierContactId === "string" ? body.supplierContactId : null,
      messageType: requireString(body.messageType, "messageType"),
      channel: requireString(body.channel, "channel"),
      subjectTemplate,
      bodyTemplate,
      data: body.data ?? {},
      revisionNo: body.revisionNo ?? 1
    });

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

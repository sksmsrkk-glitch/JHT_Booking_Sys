/**
 * @file 한글 책임: `/api/supplier-messages/[id]/requeue` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok } from "@/lib/api/http";
import { buildSupplierMessageRequeueUpdate } from "@/lib/domain/supplier-messages.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: before, error: beforeError } = await supabase
      .from("supplier_message_outbox")
      .select("*")
      .eq("id", id)
      .single();

    if (beforeError) throw new HttpError(500, beforeError.message);

    const update = buildRequeueUpdate(before);
    const { data, error } = await supabase
      .from("supplier_message_outbox")
      .update(update)
      .eq("id", id)
      .eq("status", "failed")
      .is("provider_message_id", null)
      .is("sent_at", null)
      .select("id, status, channel, message_type, idempotency_key, risk_level, error_message")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) {
      throw new HttpError(409, "Message state changed or delivery evidence exists; requeue was not applied");
    }

    const { error: eventError } = await supabase.from("supplier_message_events").insert({
      supplier_message_outbox_id: id,
      event_type: "queued",
      provider: null,
      provider_payload: {
        requeued_by: internalUser.profileId,
        previous_error: before.error_message ?? null
      }
    });

    if (eventError) throw new HttpError(500, eventError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "supplier_message.requeued",
      entityTable: "supplier_message_outbox",
      entityId: id,
      riskLevel: data.risk_level,
      beforeData: before,
      afterData: data
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

function buildRequeueUpdate(message: Record<string, unknown>) {
  try {
    return buildSupplierMessageRequeueUpdate(message);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Supplier message cannot be requeued");
  }
}

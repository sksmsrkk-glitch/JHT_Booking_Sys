import { writeAuditLog } from "@/lib/api/audit";
import { requireAutomationSecret } from "@/lib/api/guards";
import { writeApiLog } from "@/lib/api/api-log";
import { fail, HttpError, ok } from "@/lib/api/http";
import { buildSupplierMessageDeliveryAttempt } from "@/lib/domain/supplier-messages.mjs";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    requireAutomationSecret(request);
    const supabase = createServiceSupabaseClient();

    const { data: messages, error } = await supabase
      .from("supplier_message_outbox")
      .select(
        "id, reservation_id, domestic_supplier_id, supplier_contact_id, message_type, channel, risk_level, status, subject, body, idempotency_key, approved_by, approved_at, second_approved_by, provider_message_id, error_message, created_at"
      )
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw new HttpError(500, error.message);

    const results = [];
    for (const message of messages ?? []) {
      results.push(await processMessage(supabase, message));
    }

    const responsePayload = {
      checkedCount: messages?.length ?? 0,
      sentCount: results.filter((result) => result.status === "sent").length,
      simulatedCount: results.filter((result) => result.status === "simulated").length,
      failedCount: results.filter((result) => result.status === "failed").length,
      skippedCount: results.filter((result) => result.status === "skipped").length,
      results
    };

    await writeApiLog(supabase, {
      source: "automation_supplier_messages",
      endpoint: "/api/automation/supplier-messages/run",
      method: "POST",
      statusCode: responsePayload.failedCount > 0 ? 207 : 200,
      responsePayload
    });

    return ok(responsePayload);
  } catch (error) {
    return fail(error);
  }
}

async function processMessage(supabase: any, message: any) {
  try {
    const attempt = buildSupplierMessageDeliveryAttempt({
      message,
      env: process.env
    });

    // 원자적 클레임: queued 상태일 때만 sending으로 전환하고, 다른 워커가 이미
    // 가져갔으면(0행) 건너뜁니다. 이것으로 cron 중복 실행 시 이중 발송을 막습니다.
    const { data: claimed, error: sendingError } = await supabase
      .from("supplier_message_outbox")
      .update(attempt.sendingUpdate)
      .eq("id", message.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (sendingError) throw new Error(sendingError.message);
    if (!claimed) {
      return { id: message.id, status: "skipped", reason: "already claimed by another worker" };
    }

    // 실제 이메일/Kakao 발신 연동이 아직 없으므로, live 모드에서 "sent"로 기록하는 것은
    // 거짓 성공입니다. 프로바이더가 연동되기 전까지 live 발송은 명시적으로 실패시킵니다.
    if (!attempt.dryRun && process.env.SUPPLIER_MESSAGE_ALLOW_UNIMPLEMENTED_LIVE !== "on") {
      throw new Error(
        "Live supplier delivery is not implemented: no email/Kakao provider is wired. Keep SUPPLIER_MESSAGE_DELIVERY_MODE=dry_run until a provider is integrated."
      );
    }

    await insertEvent(supabase, message.id, attempt.sendingEvent);

    const { data: sent, error: sentError } = await supabase
      .from("supplier_message_outbox")
      .update(attempt.finalUpdate)
      .eq("id", message.id)
      .select("id, status, channel, provider_message_id, sent_at")
      .single();
    if (sentError) throw new Error(sentError.message);

    await insertEvent(supabase, message.id, attempt.finalEvent);
    await writeAuditLog(supabase, {
      action: "supplier_message.delivery_processed",
      entityTable: "supplier_message_outbox",
      entityId: message.id,
      riskLevel: message.risk_level,
      beforeData: { id: message.id, status: message.status },
      afterData: {
        ...sent,
        provider: attempt.provider,
        dryRun: attempt.dryRun
      }
    });

    return { id: message.id, status: attempt.dryRun ? "simulated" : "sent", provider: attempt.provider, dryRun: attempt.dryRun };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown supplier delivery error";
    await supabase
      .from("supplier_message_outbox")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", message.id);
    await insertEvent(supabase, message.id, {
      event_type: "failed",
      provider: null,
      provider_payload: { error: errorMessage }
    });
    await writeAuditLog(supabase, {
      action: "supplier_message.delivery_failed",
      entityTable: "supplier_message_outbox",
      entityId: message.id,
      riskLevel: message.risk_level,
      afterData: { error: errorMessage }
    });
    return { id: message.id, status: "failed", error: errorMessage };
  }
}

async function insertEvent(supabase: any, messageId: string, event: any) {
  const { error } = await supabase.from("supplier_message_events").insert({
    supplier_message_outbox_id: messageId,
    ...event
  });

  if (error) throw new Error(error.message);
}

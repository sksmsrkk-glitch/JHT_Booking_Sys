/**
 * @file 한글 책임: `/api/automation/supplier-messages/run` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
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

    // API 실행 로그는 발송 결과의 보조 기록입니다. 로그 장애가 확정된 발송 상태를 뒤집지 않도록 분리합니다.
    await Promise.allSettled([
      writeApiLog(supabase, {
        source: "automation_supplier_messages",
        endpoint: "/api/automation/supplier-messages/run",
        method: "POST",
        statusCode: responsePayload.failedCount > 0 ? 207 : 200,
        responsePayload
      })
    ]);

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
    if (!attempt.dryRun) {
      throw new Error(
        "Live supplier delivery is not implemented: no email/Kakao provider is wired. Keep SUPPLIER_MESSAGE_DELIVERY_MODE=dry_run until a provider is integrated."
      );
    }

    await insertEvent(supabase, message.id, attempt.sendingEvent);

    const { data: sent, error: sentError } = await supabase
      .from("supplier_message_outbox")
      .update(attempt.finalUpdate)
      .eq("id", message.id)
      .eq("status", "sending")
      .select("id, status, channel, provider_message_id, sent_at")
      .maybeSingle();
    if (sentError) throw new Error(sentError.message);
    if (!sent) {
      return { id: message.id, status: "skipped", reason: "message state changed before finalization" };
    }

    // 최종 상태 저장 이후의 이벤트/감사 로그는 best-effort로 남깁니다.
    // 부가 로그 실패를 delivery 실패로 취급하면 sent -> failed 역전과 이중 발송이 발생할 수 있습니다.
    const logResults = await Promise.allSettled([
      insertEvent(supabase, message.id, attempt.finalEvent),
      writeAuditLog(supabase, {
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
      })
    ]);

    return {
      id: message.id,
      status: attempt.dryRun ? "simulated" : "sent",
      provider: attempt.provider,
      dryRun: attempt.dryRun,
      logWarningCount: logResults.filter((result) => result.status === "rejected").length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown supplier delivery error";
    // 이 워커가 선점한 sending 행만 failed로 전환하며, 이미 완료된 상태는 절대 덮어쓰지 않습니다.
    const { data: failed, error: failedUpdateError } = await supabase
      .from("supplier_message_outbox")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", message.id)
      .eq("status", "sending")
      .select("id")
      .maybeSingle();

    if (failedUpdateError) {
      return {
        id: message.id,
        status: "failed",
        error: `${errorMessage}; state update failed: ${failedUpdateError.message}`
      };
    }
    if (!failed) {
      return { id: message.id, status: "skipped", reason: "message was already finalized", error: errorMessage };
    }

    await Promise.allSettled([
      insertEvent(supabase, message.id, {
        event_type: "failed",
        provider: null,
        provider_payload: { error: errorMessage }
      }),
      writeAuditLog(supabase, {
        action: "supplier_message.delivery_failed",
        entityTable: "supplier_message_outbox",
        entityId: message.id,
        riskLevel: message.risk_level,
        afterData: { error: errorMessage }
      })
    ]);
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

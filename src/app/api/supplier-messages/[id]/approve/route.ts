/**
 * @file 한글 책임: `/api/supplier-messages/[id]/approve` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const secondApproval = body.secondApproval === true;

    const { data: before, error: beforeError } = await supabase
      .from("supplier_message_outbox")
      .select("*")
      .eq("id", id)
      .single();

    if (beforeError) throw new HttpError(500, beforeError.message);
    if (!["draft", "pending_approval", "approved"].includes(before.status)) {
      throw new HttpError(409, `Message cannot be approved from status ${before.status}`);
    }

    const update = secondApproval
      ? {
          second_approved_by: internalUser.profileId,
          second_approved_at: new Date().toISOString(),
          status: "approved"
        }
      : {
          approved_by: internalUser.profileId,
          approved_at: new Date().toISOString(),
          status: "approved"
        };

    if (secondApproval && !before.approved_by) {
      throw new HttpError(400, "First approval is required before second approval");
    }

    if (secondApproval && before.approved_by === internalUser.profileId) {
      throw new HttpError(400, "Second approval must be performed by a different internal user");
    }

    const { data, error } = await supabase
      .from("supplier_message_outbox")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: secondApproval ? "supplier_message.second_approved" : "supplier_message.approved",
      entityTable: "supplier_message_outbox",
      entityId: id,
      riskLevel: data.risk_level,
      beforeData: before,
      afterData: data,
      approvalData: { secondApproval }
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

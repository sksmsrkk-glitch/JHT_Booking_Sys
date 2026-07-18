/**
 * @file 한글 책임: `audit` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
export async function writeAuditLog(
  supabase: any,
  input: {
    actorProfileId?: string | null;
    action: string;
    entityTable: string;
    entityId?: string | null;
    riskLevel?: "normal" | "high";
    beforeData?: unknown;
    afterData?: unknown;
    approvalData?: unknown;
    requestId?: string | null;
  }
) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_profile_id: input.actorProfileId ?? null,
    action: input.action,
    entity_table: input.entityTable,
    entity_id: input.entityId ?? null,
    risk_level: input.riskLevel ?? "normal",
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    approval_data: input.approvalData ?? null,
    request_id: input.requestId ?? null
  });

  if (error) {
    throw new Error(`Audit log failed: ${error.message}`);
  }
}

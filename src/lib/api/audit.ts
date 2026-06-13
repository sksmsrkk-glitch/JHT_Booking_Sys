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

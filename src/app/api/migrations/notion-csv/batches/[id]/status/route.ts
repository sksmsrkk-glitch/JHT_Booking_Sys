import { writeAuditLog } from "@/lib/api/audit";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, readJson, requireString } from "@/lib/api/http";
import { buildMigrationImportRows, buildMigrationStatusUpdate, validateMigrationRows } from "@/lib/domain/migration.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteParams = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: RouteParams }) {
  try {
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    const nextStatus = requireString(body.status, "status");
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: batch, error: batchError } = await supabase
      .from("migration_batches")
      .select("id, source_name, target_table, status")
      .eq("id", id)
      .maybeSingle();

    if (batchError) throw new HttpError(500, batchError.message);
    if (!batch) throw new HttpError(404, "Migration batch not found");

    if (nextStatus === "validated") {
      return await validateBatch({ supabase, batch, actorProfileId: internalUser.profileId });
    }

    if (nextStatus === "approved") {
      return await approveBatch({ supabase, batch, actorProfileId: internalUser.profileId });
    }

    if (nextStatus === "failed") {
      return await failBatch({ supabase, batch, actorProfileId: internalUser.profileId });
    }

    if (nextStatus === "imported") {
      return await importBatch({ supabase, batch, actorProfileId: internalUser.profileId });
    }

    throw new HttpError(400, "Unsupported migration status action");
  } catch (error) {
    return fail(error);
  }
}

async function importBatch({
  supabase,
  batch,
  actorProfileId
}: {
  supabase: any;
  batch: { id: string; source_name: string; target_table: string; status: string };
  actorProfileId: string;
}) {
  const { count: errorCount, error: errorCountError } = await supabase
    .from("migration_errors")
    .select("id", { count: "exact", head: true })
    .eq("migration_batch_id", batch.id);

  if (errorCountError) throw new HttpError(500, errorCountError.message);
  if ((errorCount ?? 0) > 0) {
    throw new HttpError(409, "Migration batch has validation errors and cannot be imported");
  }

  const { data: rows, error: rowError } = await supabase
    .from("staging_rows")
    .select("id, row_no, mapped_payload, validation_status")
    .eq("migration_batch_id", batch.id)
    .eq("validation_status", "valid")
    .order("row_no", { ascending: true });

  if (rowError) throw new HttpError(500, rowError.message);

  const importRows = buildMigrationImportRows({
    targetTable: batch.target_table,
    rows: rows ?? []
  });

  const statusUpdate = buildMigrationStatusUpdate({
    currentStatus: batch.status,
    nextStatus: "imported",
    actorProfileId
  });

  // 원자적 클레임: approved 상태일 때만 imported로 전환합니다. 동시 요청/재시도가
  // 프로덕션 테이블에 행을 두 번 넣지 못하게, insert 전에 먼저 상태를 선점합니다.
  const { data: claimedBatch, error: claimError } = await supabase
    .from("migration_batches")
    .update({ status: statusUpdate.status })
    .eq("id", batch.id)
    .eq("status", "approved")
    .select("id, source_name, target_table, status, updated_at")
    .maybeSingle();

  if (claimError) throw new HttpError(500, claimError.message);
  if (!claimedBatch) {
    throw new HttpError(409, "Migration batch is not in approved state (already imported or concurrently changed)");
  }

  const { data: importedRows, error: importError } = await supabase
    .from(batch.target_table)
    .insert(importRows)
    .select("id");

  if (importError) {
    // 삽입 실패 시 배치를 failed로 되돌리고 사유를 기록해, imported로 잘못 남지 않게 합니다.
    await supabase.from("migration_batches").update({ status: "failed" }).eq("id", batch.id);
    await supabase.from("migration_errors").insert({
      migration_batch_id: batch.id,
      staging_row_id: null,
      error_code: "import_failed",
      error_message: importError.message
    });
    throw new HttpError(500, importError.message);
  }

  const updatedBatch = claimedBatch;

  await writeAuditLog(supabase, {
    actorProfileId: statusUpdate.audit.actorProfileId,
    action: statusUpdate.audit.action,
    entityTable: "migration_batches",
    entityId: batch.id,
    riskLevel: toAuditRiskLevel(statusUpdate.audit.riskLevel),
    beforeData: { status: batch.status },
    afterData: {
      status: statusUpdate.status,
      targetTable: batch.target_table,
      importedRowCount: importedRows?.length ?? importRows.length
    },
    approvalData: statusUpdate.audit.approvalData
  });

  return ok({ batch: updatedBatch, importedRowCount: importedRows?.length ?? importRows.length });
}

async function validateBatch({
  supabase,
  batch,
  actorProfileId
}: {
  supabase: any;
  batch: { id: string; source_name: string; target_table: string; status: string };
  actorProfileId: string;
}) {
  const { data: rows, error: rowError } = await supabase
    .from("staging_rows")
    .select("id, row_no, raw_payload")
    .eq("migration_batch_id", batch.id)
    .order("row_no", { ascending: true });

  if (rowError) throw new HttpError(500, rowError.message);

  const validation = validateMigrationRows({
    targetTable: batch.target_table,
    rows: rows ?? []
  });
  const statusUpdate = buildMigrationStatusUpdate({
    currentStatus: batch.status,
    nextStatus: validation.status,
    actorProfileId
  });

  const { error: deleteError } = await supabase.from("migration_errors").delete().eq("migration_batch_id", batch.id);
  if (deleteError) throw new HttpError(500, deleteError.message);

  for (const row of validation.rows) {
    const { error } = await supabase
      .from("staging_rows")
      .update({
        mapped_payload: row.mappedPayload,
        validation_status: row.validationStatus
      })
      .eq("id", row.id);
    if (error) throw new HttpError(500, error.message);
  }

  if (validation.errors.length > 0) {
    const { error } = await supabase.from("migration_errors").insert(
      validation.errors.map((migrationError) => ({
        migration_batch_id: batch.id,
        staging_row_id: migrationError.stagingRowId,
        error_code: migrationError.errorCode,
        error_message: migrationError.errorMessage
      }))
    );
    if (error) throw new HttpError(500, error.message);
  }

  const { data: updatedBatch, error: updateError } = await supabase
    .from("migration_batches")
    .update({ status: validation.status })
    .eq("id", batch.id)
    .select("id, source_name, target_table, status, updated_at")
    .single();

  if (updateError) throw new HttpError(500, updateError.message);

  await writeAuditLog(supabase, {
    actorProfileId: statusUpdate.audit.actorProfileId,
    action: statusUpdate.audit.action,
    entityTable: "migration_batches",
    entityId: batch.id,
    riskLevel: toAuditRiskLevel(statusUpdate.audit.riskLevel),
    beforeData: { status: batch.status },
    afterData: {
      status: validation.status,
      rowCount: validation.rowCount,
      validRowCount: validation.validRowCount,
      errorCount: validation.errorCount
    },
    approvalData: statusUpdate.audit.approvalData
  });

  return ok({ batch: updatedBatch, validation });
}

async function approveBatch({
  supabase,
  batch,
  actorProfileId
}: {
  supabase: any;
  batch: { id: string; source_name: string; target_table: string; status: string };
  actorProfileId: string;
}) {
  const { count: errorCount, error: errorCountError } = await supabase
    .from("migration_errors")
    .select("id", { count: "exact", head: true })
    .eq("migration_batch_id", batch.id);

  if (errorCountError) throw new HttpError(500, errorCountError.message);
  if ((errorCount ?? 0) > 0) {
    throw new HttpError(409, "Migration batch has validation errors and cannot be approved");
  }

  const statusUpdate = buildMigrationStatusUpdate({
    currentStatus: batch.status,
    nextStatus: "approved",
    actorProfileId
  });

  const { data: updatedBatch, error: updateError } = await supabase
    .from("migration_batches")
    .update({ status: statusUpdate.status })
    .eq("id", batch.id)
    .select("id, source_name, target_table, status, updated_at")
    .single();

  if (updateError) throw new HttpError(500, updateError.message);

  await writeAuditLog(supabase, {
    actorProfileId: statusUpdate.audit.actorProfileId,
    action: statusUpdate.audit.action,
    entityTable: "migration_batches",
    entityId: batch.id,
    riskLevel: toAuditRiskLevel(statusUpdate.audit.riskLevel),
    beforeData: { status: batch.status },
    afterData: { status: statusUpdate.status },
    approvalData: statusUpdate.audit.approvalData
  });

  return ok({ batch: updatedBatch });
}

async function failBatch({
  supabase,
  batch,
  actorProfileId
}: {
  supabase: any;
  batch: { id: string; source_name: string; target_table: string; status: string };
  actorProfileId: string;
}) {
  const statusUpdate = buildMigrationStatusUpdate({
    currentStatus: batch.status,
    nextStatus: "failed",
    actorProfileId
  });

  const { data: updatedBatch, error: updateError } = await supabase
    .from("migration_batches")
    .update({ status: statusUpdate.status })
    .eq("id", batch.id)
    .select("id, source_name, target_table, status, updated_at")
    .single();

  if (updateError) throw new HttpError(500, updateError.message);

  await writeAuditLog(supabase, {
    actorProfileId: statusUpdate.audit.actorProfileId,
    action: statusUpdate.audit.action,
    entityTable: "migration_batches",
    entityId: batch.id,
    riskLevel: toAuditRiskLevel(statusUpdate.audit.riskLevel),
    beforeData: { status: batch.status },
    afterData: { status: statusUpdate.status },
    approvalData: statusUpdate.audit.approvalData
  });

  return ok({ batch: updatedBatch });
}

function toAuditRiskLevel(value: string) {
  return value === "high" ? "high" : "normal";
}

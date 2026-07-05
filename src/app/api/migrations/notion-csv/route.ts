import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireArray, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_TARGET_TABLES = [
  "agency_accounts",
  "agency_contacts",
  "domestic_suppliers",
  "supplier_contacts",
  "supplier_products",
  "supplier_prices",
  "supplier_media"
];

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const targetTable = requireString(body.targetTable, "targetTable");

    if (!ALLOWED_TARGET_TABLES.includes(targetTable)) {
      throw new HttpError(400, "Unsupported targetTable for Notion CSV staging");
    }

    const rows = requireArray<Record<string, unknown>>(body.rows, "rows");
    if (rows.length === 0) {
      throw new HttpError(400, "rows must not be empty");
    }

    const { data: batch, error: batchError } = await supabase
      .from("migration_batches")
      .insert({
        source_name: requireString(body.sourceName, "sourceName"),
        source_kind: "notion_csv",
        target_table: targetTable,
        status: "uploaded",
        uploaded_by: internalUser.profileId
      })
      .select("id, source_name, target_table, status, created_at")
      .single();

    if (batchError) throw new HttpError(500, batchError.message);

    const stagingRows = rows.map((row, index) => ({
      migration_batch_id: batch.id,
      row_no: index + 1,
      raw_payload: row,
      mapped_payload: {},
      validation_status: "pending"
    }));

    const { error: rowError } = await supabase.from("staging_rows").insert(stagingRows);
    if (rowError) throw new HttpError(500, rowError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "notion_csv.staged",
      entityTable: "migration_batches",
      entityId: batch.id,
      afterData: { targetTable, rowCount: rows.length }
    });

    return created({ batch, rowCount: rows.length });
  } catch (error) {
    return fail(error);
  }
}

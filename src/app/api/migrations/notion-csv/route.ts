import { requireInternalUser } from "@/lib/api/auth";
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
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const targetTable = requireString(body.targetTable, "targetTable");

    if (!ALLOWED_TARGET_TABLES.includes(targetTable)) {
      throw new HttpError(400, "Unsupported targetTable for Notion CSV staging");
    }

    const rows = requireArray<Record<string, unknown>>(body.rows, "rows");
    if (rows.length === 0) {
      throw new HttpError(400, "rows must not be empty");
    }

    // 배치, staging 행, 감사 로그를 DB 함수 안의 단일 트랜잭션으로 기록합니다.
    // 같은 멱등성 키로 재시도하면 이미 생성된 배치를 그대로 반환합니다.
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;
    const { data: result, error: stagingError } = await supabase.rpc("stage_notion_csv_batch_atomic", {
      p_source_name: requireString(body.sourceName, "sourceName"),
      p_target_table: targetTable,
      p_rows: rows,
      p_uploaded_by: internalUser.profileId,
      p_idempotency_key: idempotencyKey
    });
    if (stagingError) throw new HttpError(500, stagingError.message);

    return created(result);
  } catch (error) {
    return fail(error);
  }
}

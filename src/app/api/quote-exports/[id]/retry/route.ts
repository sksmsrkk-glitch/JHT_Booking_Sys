/**
 * @file 한글 책임: `/api/quote-exports/[id]/retry` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok } from "@/lib/api/http";
import { buildQuoteExportRetryUpdate } from "@/lib/domain/quote-export.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: before, error: beforeError } = await supabase
      .from("quote_exports")
      .select("id, quote_version_id, export_type, storage_path, status, error_message, created_by, created_at")
      .eq("id", id)
      .single();

    if (beforeError) throw new HttpError(500, beforeError.message);

    const update = {
      ...buildRetryUpdate(before),
      locked_at: null,
      locked_by: null,
      lease_expires_at: null
    };
    const { data, error } = await supabase
      .from("quote_exports")
      .update(update)
      .eq("id", id)
      .select("id, quote_version_id, export_type, storage_path, status, error_message, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_export.requeued",
      entityTable: "quote_exports",
      entityId: id,
      beforeData: before,
      afterData: data
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

function buildRetryUpdate(exportRow: Record<string, unknown>) {
  try {
    return buildQuoteExportRetryUpdate(exportRow);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Quote export cannot be retried");
  }
}

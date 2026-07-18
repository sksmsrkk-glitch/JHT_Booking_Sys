/**
 * @file 한글 책임: `/api/quote-versions/[id]/export-xlsx` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok } from "@/lib/api/http";
import { buildQuoteExportRequest, QUOTE_EXPORT_ACTIVE_STATUSES } from "@/lib/domain/quote-export.mjs";
import { makeExportPath } from "@/lib/domain/ids";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data: version, error: versionError } = await supabase
      .from("quote_versions")
      .select("id, status, public_total_amount")
      .eq("id", id)
      .maybeSingle();

    if (versionError) throw new HttpError(500, versionError.message);
    if (!version) throw new HttpError(404, "Quote version not found");

    const { data: existing, error: existingError } = await supabase
      .from("quote_exports")
      .select("id, quote_version_id, export_type, storage_path, status, error_message, created_at")
      .eq("quote_version_id", id)
      .eq("export_type", "xlsx")
      .in("status", QUOTE_EXPORT_ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message);
    if (existing) return ok(existing);

    const storagePath = makeExportPath(id);
    const exportRow = buildQuoteExportRequest({
      quoteVersionId: id,
      versionStatus: version.status,
      publicTotalAmount: Number(version.public_total_amount ?? 0),
      storagePath
    });

    const { data, error } = await supabase
      .from("quote_exports")
      .insert({
        ...exportRow,
        created_by: internalUser.profileId
      })
      .select("id, quote_version_id, export_type, storage_path, status, error_message, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_export.queued",
      entityTable: "quote_exports",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

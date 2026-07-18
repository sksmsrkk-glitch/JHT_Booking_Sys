/**
 * @file 한글 책임: `/api/agency/quote-cases/[id]/revision-request` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, readJson, requireString, throwRpcError } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);

    // 문의 insert와 quote_cases 상태 전환, 감사 로그가 모두 성공해야만 커밋됩니다.
    const { data: result, error } = await supabase.rpc("submit_agency_quote_request_atomic", {
      p_agency_account_id: agencyUser.agencyAccountId,
      p_agency_user_id: agencyUser.agencyUserId,
      p_quote_case_id: id,
      p_inquiry_type: "revision_request",
      p_title: requireString(body.title, "title"),
      p_message: requireString(body.message, "message"),
      p_requested_changes: Array.isArray(body.requestedChanges) ? body.requestedChanges : [],
      p_quote_version_id: null,
      p_agency_reference_no: null,
      p_idempotency_key: request.headers.get("idempotency-key")?.trim() || null
    });
    if (error) throwRpcError(error);
    if (!result?.inquiry?.id) throw new HttpError(500, "Revision request was not returned");
    return created({ ...result.inquiry, existing: Boolean(result.existing) });
  } catch (error) {
    return fail(error);
  }
}

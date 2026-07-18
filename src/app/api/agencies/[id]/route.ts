/**
 * @file 한글 책임: `/api/agencies/[id]` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { getAgencyAccountDetail } from "@/features/agency/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const { id } = await context.params;
    const agency = await getAgencyAccountDetail(supabase, id);
    if (!agency) {
      throw new HttpError(404, "Overseas agency not found");
    }

    return ok(agency);
  } catch (error) {
    return fail(error);
  }
}

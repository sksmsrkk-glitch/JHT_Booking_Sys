/**
 * @file 한글 책임: `/api/auth/password-reset-complete` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { fail, ok } from "@/lib/api/http";
import { requireCurrentUser } from "@/lib/api/auth";
import { createRequestSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const user = await requireCurrentUser(supabase);
    const service = createServiceSupabaseClient();

    // 파트너 계정이면 최초 비밀번호 설정/재설정 필요 플래그를 함께 해제합니다. 내부 계정에는 영향이 없습니다.
    const { error } = await service
      .from("agency_users")
      .update({ password_reset_required: false })
      .eq("auth_user_id", user.id);
    if (error) throw error;

    return ok({ completed: true });
  } catch (error) {
    return fail(error);
  }
}

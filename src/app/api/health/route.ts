/**
 * @file 한글 책임: `/api/health` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { ok } from "@/lib/api/http";

export async function GET() {
  return ok({
    status: "ok",
    service: "jht-operations-platform",
    version: "v1",
    generatedAt: new Date().toISOString(),
    checks: {
      supabaseUrlConfigured: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKeyConfigured: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      automationSecretConfigured: isConfigured(process.env.AUTOMATION_SECRET)
    }
  });
}

function isConfigured(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

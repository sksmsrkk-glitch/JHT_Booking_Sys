/**
 * @file 한글 책임: `page session` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
import { cookies, headers } from "next/headers";
import { normalizeSessionSurface, sessionCookieNames } from "@/lib/domain/auth-session.mjs";

export async function getPageAuthorization() {
  const headerStore = await headers();
  const directAuthorization = headerStore.get("authorization");
  if (directAuthorization) {
    return { authorization: directAuthorization, headerStore };
  }

  // x-jht-surface는 미들웨어가 클라이언트 값을 덮어써서 설정하므로 위조될 수 없습니다.
  // 포털별 쿠키만 읽어 파트너 세션이 어드민 화면 인증에 쓰이는 교차 사용을 차단합니다.
  const surface = normalizeSessionSurface(headerStore.get("x-jht-surface"));
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(sessionCookieNames(surface).access)?.value;
  return {
    authorization: accessToken ? `Bearer ${accessToken}` : "",
    headerStore
  };
}

export function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

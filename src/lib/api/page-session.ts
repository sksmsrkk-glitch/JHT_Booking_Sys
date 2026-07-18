/**
 * @file 한글 책임: `page session` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
import { cookies, headers } from "next/headers";

export async function getPageAuthorization() {
  const headerStore = await headers();
  const directAuthorization = headerStore.get("authorization");
  if (directAuthorization) {
    return { authorization: directAuthorization, headerStore };
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("jht_access_token")?.value;
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

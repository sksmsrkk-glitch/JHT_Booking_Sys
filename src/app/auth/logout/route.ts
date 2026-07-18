/**
 * @file 한글 책임: Next.js App Router의 `/auth/logout` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/domain/auth-session.mjs";

/**
 * 로그아웃은 쿠키를 삭제하는 상태 변경 작업이므로 GET 프리페치로 실행되지 않게 POST만 허용합니다.
 */
export function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(resolveLogoutDestination(request, requestUrl), 303);
  response.headers.set("Cache-Control", "no-store");
  const secure = requestUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  for (const cookieName of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure
    });
  }
  return response;
}

function resolveLogoutDestination(request: Request, requestUrl: URL) {
  const referer = request.headers.get("referer");
  if (!referer) return new URL("/", requestUrl);

  try {
    const source = new URL(referer);
    if (source.origin === requestUrl.origin && (source.pathname === "/agency" || source.pathname.startsWith("/agency/"))) {
      return new URL("/agency", requestUrl);
    }
  } catch {
    // 잘못된 Referer는 신뢰하지 않고 공용 홈으로 이동합니다.
  }
  return new URL("/", requestUrl);
}

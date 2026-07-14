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

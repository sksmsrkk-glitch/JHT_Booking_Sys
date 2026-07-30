/**
 * @file 한글 책임: Next.js App Router의 `/auth/logout` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  AGENCY_ACCESS_TOKEN_COOKIE,
  AGENCY_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sessionCookieNames
} from "@/lib/domain/auth-session.mjs";

/**
 * 로그아웃은 쿠키를 삭제하는 상태 변경 작업이므로 GET 프리페치로 실행되지 않게 POST만 허용합니다.
 * 로그아웃한 포털의 세션 쿠키만 정리해, 같은 브라우저에 공존하는 다른 포털 세션을 끊지 않습니다.
 */
export function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const sourceSurface = resolveSourceSurface(request, requestUrl);
  const response = NextResponse.redirect(
    new URL(sourceSurface === "agency" ? "/agency" : "/", requestUrl),
    303
  );
  response.headers.set("Cache-Control", "no-store");
  const secure = requestUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  const cookiesToClear = sourceSurface
    ? Object.values(sessionCookieNames(sourceSurface))
    : [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, AGENCY_ACCESS_TOKEN_COOKIE, AGENCY_REFRESH_TOKEN_COOKIE];
  for (const cookieName of cookiesToClear) {
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

/** Referer로 어느 포털에서 로그아웃했는지 판단합니다. 신뢰할 수 없으면 null을 돌려 모든 세션을 정리합니다. */
function resolveSourceSurface(request: Request, requestUrl: URL): "internal" | "agency" | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    const source = new URL(referer);
    if (source.origin !== requestUrl.origin) return null;
    if (source.pathname === "/agency" || source.pathname.startsWith("/agency/")) return "agency";
    return "internal";
  } catch {
    return null;
  }
}

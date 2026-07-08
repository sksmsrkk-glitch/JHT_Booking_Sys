import { NextResponse, type NextRequest } from "next/server";
import { normalizeLocale } from "@/lib/i18n";

export function middleware(request: NextRequest) {
  const requestedLocale = request.nextUrl.searchParams.get("lang");
  const isAgencyPortal = request.nextUrl.pathname === "/agency" || request.nextUrl.pathname.startsWith("/agency/");
  // 파트너 포털은 해외 파트너 전용 화면이므로 KOR 쿠키나 ?lang=ko가 있어도 항상 영문으로 고정합니다.
  const locale = isAgencyPortal ? "en" : normalizeLocale(requestedLocale ?? request.cookies.get("jht_locale")?.value);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-jht-locale", locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  if (requestedLocale && !isAgencyPortal) {
    response.cookies.set("jht_locale", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

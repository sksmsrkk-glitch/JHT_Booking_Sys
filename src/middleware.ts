import { NextResponse, type NextRequest } from "next/server";
import { normalizeLocale } from "@/lib/i18n";

export function middleware(request: NextRequest) {
  const requestedLocale = request.nextUrl.searchParams.get("lang");
  const locale = normalizeLocale(requestedLocale ?? request.cookies.get("jht_locale")?.value);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-jht-locale", locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  if (requestedLocale) {
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

import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/domain/auth-session.mjs";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", requestUrl));
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

import { NextResponse } from "next/server";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", requestUrl));
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set("jht_access_token", "", {
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: requestUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"
  });
  return response;
}

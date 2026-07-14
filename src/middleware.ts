import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  isAccessTokenStale,
  REFRESH_TOKEN_COOKIE
} from "@/lib/domain/auth-session.mjs";

const PUBLIC_AGENCY_PATHS = new Set([
  "/agency",
  "/agency/login",
  "/agency/signup",
  "/agency/forgot-email",
  "/agency/forgot-password",
  "/agency/reset-password"
]);
const PUBLIC_ADMIN_PATHS = new Set(["/admin/bootstrap"]);
const refreshTokenMaxAgeSeconds = 60 * 60 * 24 * 30;

type RefreshedSession = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
};

/**
 * 관리자와 파트너 업무 화면의 인증 경계를 관리합니다.
 * access token이 만료되기 직전이면 HttpOnly refresh token으로 세션을 갱신해 사용자가 작업 중
 * 반복해서 로그인 화면으로 돌아가지 않도록 합니다.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.NODE_ENV !== "production" && ["on", "true", "1"].includes(process.env.JHT_DEMO_MODE ?? "")) {
    return continueRequest(request);
  }

  const protectedAgencyPath = path.startsWith("/agency") && !PUBLIC_AGENCY_PATHS.has(path);
  const protectedAdminPath = path.startsWith("/admin") && !PUBLIC_ADMIN_PATHS.has(path);
  if (!protectedAgencyPath && !protectedAdminPath) return continueRequest(request);

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? "";
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? "";
  if (accessToken && !isAccessTokenStale(accessToken)) return continueRequest(request);

  if (refreshToken) {
    const refreshed = await refreshSupabaseSession(refreshToken);
    if (refreshed) return continueWithRefreshedSession(request, refreshed);
  }

  return redirectToLogin(request, protectedAgencyPath);
}

function continueRequest(request: NextRequest) {
  return NextResponse.next({ request: { headers: buildSurfaceRequestHeaders(request) } });
}

async function refreshSupabaseSession(refreshToken: string): Promise<RefreshedSession | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      headers: {
        apikey: publishableKey,
        "content-type": "application/json"
      },
      method: "POST"
    });
    if (!response.ok) return null;

    const payload = await response.json() as Record<string, unknown>;
    if (
      typeof payload.access_token !== "string" ||
      typeof payload.refresh_token !== "string" ||
      typeof payload.expires_in !== "number"
    ) {
      return null;
    }

    return {
      accessToken: payload.access_token,
      expiresIn: payload.expires_in,
      refreshToken: payload.refresh_token
    };
  } catch {
    return null;
  }
}

function continueWithRefreshedSession(request: NextRequest, session: RefreshedSession) {
  const requestHeaders = buildSurfaceRequestHeaders(request);
  requestHeaders.set("cookie", buildForwardedCookieHeader(request, session));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const secure = isHttpsRequest(request);

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.accessToken, {
    httpOnly: true,
    maxAge: normalizeExpiresIn(session.expiresIn),
    path: "/",
    sameSite: "lax",
    secure
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    httpOnly: true,
    maxAge: refreshTokenMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure
  });
  return response;
}

function buildSurfaceRequestHeaders(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  if (request.nextUrl.pathname === "/agency" || request.nextUrl.pathname.startsWith("/agency/")) {
    // 파트너 포털은 해외 사용자 전용이므로 관리자 언어 쿠키와 무관하게 영어로 렌더링합니다.
    requestHeaders.set("x-jht-locale", "en");
    requestHeaders.set("x-jht-surface", "agency");
  }
  return requestHeaders;
}

function buildForwardedCookieHeader(request: NextRequest, session: RefreshedSession) {
  const cookies = request.cookies
    .getAll()
    .filter(({ name }) => name !== ACCESS_TOKEN_COOKIE && name !== REFRESH_TOKEN_COOKIE)
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`);
  cookies.push(`${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(session.accessToken)}`);
  cookies.push(`${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(session.refreshToken)}`);
  return cookies.join("; ");
}

function redirectToLogin(request: NextRequest, isAgencyPath: boolean) {
  const loginUrl = new URL(isAgencyPath ? "/agency/login" : "/auth/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  const secure = isHttpsRequest(request);

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

function isHttpsRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function normalizeExpiresIn(expiresIn: number) {
  return Math.min(60 * 60 * 8, Math.max(60, Math.floor(expiresIn)));
}

export const config = {
  matcher: ["/admin/:path*", "/agency/:path*"]
};

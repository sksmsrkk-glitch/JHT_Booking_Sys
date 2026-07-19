/**
 * @file 한글 책임: Next.js App Router의 `/auth/session` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  getVerifiedAccessTokenClaims,
  isAccessTokenForProject,
  isAccessTokenStale,
  REFRESH_TOKEN_COOKIE
} from "@/lib/domain/auth-session.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

const fallbackMaxAgeSeconds = 60 * 60;
const maximumMaxAgeSeconds = 60 * 60 * 8;
const minimumMaxAgeSeconds = 60;
const refreshTokenMaxAgeSeconds = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isAllowedOrigin(request, requestUrl)) {
    return jsonResponse({ error: "Invalid session origin" }, { status: 403 });
  }

  let payload: { accessToken?: unknown; expiresIn?: unknown; refreshToken?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid session payload" }, { status: 400 });
  }

  if (typeof payload.accessToken !== "string" || payload.accessToken.trim().length === 0) {
    return jsonResponse({ error: "accessToken is required" }, { status: 400 });
  }
  if (payload.refreshToken !== undefined && (typeof payload.refreshToken !== "string" || payload.refreshToken.trim().length === 0)) {
    return jsonResponse({ error: "refreshToken must be a non-empty string" }, { status: 400 });
  }
  if (!(await isVerifiedAccessToken(payload.accessToken, requestUrl))) {
    return jsonResponse({ error: "Invalid or expired access token" }, { status: 401 });
  }

  const maxAge = resolveMaxAgeSeconds(payload.expiresIn);
  const response = jsonResponse({ ok: true });
  const secure = isHttpsRequest(request, requestUrl);
  response.cookies.set(ACCESS_TOKEN_COOKIE, payload.accessToken, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure
  });
  if (typeof payload.refreshToken === "string") {
    response.cookies.set(REFRESH_TOKEN_COOKIE, payload.refreshToken, {
      httpOnly: true,
      maxAge: refreshTokenMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure
    });
  }
  return response;
}

/** 브라우저가 전달한 토큰을 현재 Supabase 프로젝트의 서명된 사용자 JWT로 확인한 뒤에만 쿠키를 발급합니다. */
async function isVerifiedAccessToken(accessToken: string, requestUrl: URL) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (isAccessTokenStale(accessToken, Math.floor(Date.now() / 1000), 0)) return false;
  if (!isAccessTokenForProject(accessToken, supabaseUrl)) return false;

  try {
    const verificationRequest = new Request(requestUrl, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const supabase = createRequestSupabaseClient(verificationRequest);
    const claims = await getVerifiedAccessTokenClaims(supabase.auth, accessToken);
    return typeof claims?.sub === "string" && claims.sub.length > 0;
  } catch {
    return false;
  }
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...Object.fromEntries(new Headers(init?.headers))
    }
  });
}

function isHttpsRequest(request: Request, requestUrl: URL) {
  return requestUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function resolveMaxAgeSeconds(expiresIn: unknown) {
  const value = typeof expiresIn === "number" ? expiresIn : Number(expiresIn);
  if (!Number.isFinite(value) || value <= 0) {
    return fallbackMaxAgeSeconds;
  }
  return Math.min(maximumMaxAgeSeconds, Math.max(minimumMaxAgeSeconds, Math.floor(value)));
}

function isAllowedOrigin(request: Request, requestUrl: URL) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const allowedHosts = new Set([
      requestUrl.host,
      request.headers.get("host"),
      request.headers.get("x-forwarded-host")
    ].filter(Boolean));
    return allowedHosts.has(originUrl.host);
  } catch {
    return false;
  }
}

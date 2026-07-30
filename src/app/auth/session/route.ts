/**
 * @file 한글 책임: Next.js App Router의 `/auth/session` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import { NextResponse } from "next/server";
import {
  getVerifiedAccessTokenClaims,
  isAccessTokenForProject,
  isAccessTokenStale,
  normalizeSessionSurface,
  sessionCookieNames
} from "@/lib/domain/auth-session.mjs";
import { requireAgencyUser, requireInternalUser } from "@/lib/api/auth";
import { HttpError } from "@/lib/api/http";
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

  let payload: { accessToken?: unknown; accountType?: unknown; expiresIn?: unknown; refreshToken?: unknown };
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

  const surface = normalizeSessionSurface(payload.accountType);
  const verification = await verifyAccessTokenForSurface(payload.accessToken, surface, requestUrl);
  if (!verification.ok) {
    return jsonResponse({ error: verification.message }, { status: verification.status });
  }

  const cookieNamesForSurface = sessionCookieNames(surface);
  const maxAge = resolveMaxAgeSeconds(payload.expiresIn);
  const response = jsonResponse({ ok: true });
  const secure = isHttpsRequest(request, requestUrl);
  response.cookies.set(cookieNamesForSurface.access, payload.accessToken, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure
  });
  if (typeof payload.refreshToken === "string") {
    response.cookies.set(cookieNamesForSurface.refresh, payload.refreshToken, {
      httpOnly: true,
      maxAge: refreshTokenMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure
    });
  }
  return response;
}

/**
 * 브라우저가 전달한 토큰을 현재 Supabase 프로젝트의 서명된 사용자 JWT로 확인하고,
 * 요청한 포털에 실제 소속(내부 역할 또는 활성 파트너 계정)이 있는 계정만 쿠키를 발급합니다.
 * 소속 검증을 로그인 시점에 하면, 엉뚱한 포털에 세션이 생겨 화면마다 역할 오류가 뜨는 상태를 원천 차단합니다.
 */
async function verifyAccessTokenForSurface(
  accessToken: string,
  surface: "internal" | "agency",
  requestUrl: URL
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (isAccessTokenStale(accessToken, Math.floor(Date.now() / 1000), 0)) {
    return { ok: false, status: 401, message: "Invalid or expired access token" };
  }
  if (!isAccessTokenForProject(accessToken, supabaseUrl)) {
    return { ok: false, status: 401, message: "Invalid or expired access token" };
  }

  try {
    const verificationRequest = new Request(requestUrl, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const supabase = createRequestSupabaseClient(verificationRequest);
    const claims = await getVerifiedAccessTokenClaims(supabase.auth, accessToken);
    if (typeof claims?.sub !== "string" || claims.sub.length === 0) {
      return { ok: false, status: 401, message: "Invalid or expired access token" };
    }

    if (surface === "agency") {
      await requireAgencyUser(supabase);
    } else {
      await requireInternalUser(supabase);
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
      return {
        ok: false,
        status: 403,
        message:
          surface === "agency"
            ? "This account does not have partner portal access."
            : "This account does not have internal portal access."
      };
    }
    return { ok: false, status: 500, message: "Session verification failed" };
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

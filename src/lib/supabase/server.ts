/**
 * @file 한글 책임: `server` Supabase 클라이언트의 실행 환경별 생성과 세션 전달을 담당합니다.
 * 서버 전용 비밀키와 브라우저 공개키가 섞이지 않도록 클라이언트 경계를 분리하고 요청 단위 인증 정보를 보존합니다.
 */
import { createClient } from "@supabase/supabase-js";
import { ACCESS_TOKEN_COOKIE, extractBearerToken } from "@/lib/domain/auth-session.mjs";

// 요청 단위 JWT는 Supabase 클라이언트 객체와 WeakMap으로 연결해 로그나 직렬화 결과에 노출하지 않습니다.
const requestAccessTokens = new WeakMap<object, string>();

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createRequestSupabaseClient(request: Request) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const authorization = request.headers.get("authorization") ?? cookieAuthorization(request);

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {}
    }
  });

  requestAccessTokens.set(client, extractBearerToken(authorization));
  return client;
}

/** 인증 경계가 서명 검증에 사용할 현재 요청의 access token을 반환합니다. */
export function getRequestAccessToken(client: object) {
  return requestAccessTokens.get(client) ?? "";
}

function cookieAuthorization(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const accessToken = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`))
    ?.slice(`${ACCESS_TOKEN_COOKIE}=`.length);

  return accessToken ? `Bearer ${decodeURIComponent(accessToken)}` : "";
}

export function createServiceSupabaseClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

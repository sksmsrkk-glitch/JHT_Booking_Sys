/**
 * @file 한글 책임: `server` Supabase 클라이언트의 실행 환경별 생성과 세션 전달을 담당합니다.
 * 서버 전용 비밀키와 브라우저 공개키가 섞이지 않도록 클라이언트 경계를 분리하고 요청 단위 인증 정보를 보존합니다.
 */
import { createClient } from "@supabase/supabase-js";

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

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {}
    }
  });
}

function cookieAuthorization(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const accessToken = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("jht_access_token="))
    ?.slice("jht_access_token=".length);

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

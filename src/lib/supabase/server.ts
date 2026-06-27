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

import { NextResponse } from "next/server";

const fallbackMaxAgeSeconds = 60 * 60;
const maximumMaxAgeSeconds = 60 * 60 * 8;
const minimumMaxAgeSeconds = 60;

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isAllowedOrigin(request, requestUrl)) {
    return jsonResponse({ error: "Invalid session origin" }, { status: 403 });
  }

  let payload: { accessToken?: unknown; expiresIn?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid session payload" }, { status: 400 });
  }

  if (typeof payload.accessToken !== "string" || payload.accessToken.trim().length === 0) {
    return jsonResponse({ error: "accessToken is required" }, { status: 400 });
  }

  const maxAge = resolveMaxAgeSeconds(payload.expiresIn);
  const response = jsonResponse({ ok: true });
  response.cookies.set("jht_access_token", payload.accessToken, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: isHttpsRequest(request, requestUrl)
  });
  return response;
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

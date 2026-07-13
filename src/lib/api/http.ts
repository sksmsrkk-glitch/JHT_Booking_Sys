import { NextResponse } from "next/server";

import { sanitizeApiLogPayload } from "@/lib/domain/api-log.mjs";

// 운영/회계/파트너 데이터는 화면마다 최신 상태가 중요하므로 API JSON 응답은 기본적으로 캐시하지 않습니다.
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const maxBytes = resolveMaxJsonBytes();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, `JSON body exceeds the ${maxBytes} byte limit`);
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) {
      throw new HttpError(413, `JSON body exceeds the ${maxBytes} byte limit`);
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON body");
  }
}

function resolveMaxJsonBytes() {
  const configured = Number(process.env.API_MAX_JSON_BYTES ?? 1_048_576);
  if (!Number.isFinite(configured) || configured < 1_024) {
    return 1_048_576;
  }
  return Math.min(configured, 5_242_880);
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok(data: unknown, init?: ResponseInit) {
  return jsonResponse({ data }, init);
}

export function created(data: unknown) {
  return ok(data, { status: 201 });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    if (error.status >= 500) logInternalError(error);
    return jsonResponse({ error: publicErrorMessage(error) }, { status: error.status });
  }

  if (error instanceof Error) {
    // 서버 내부 에러 메시지는 DB 구조나 보안 정보를 포함할 수 있으므로 외부에 그대로 노출하지 않습니다.
    logInternalError(error);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  }

  logInternalError(error);
  return jsonResponse({ error: "Unknown error" }, { status: 500 });
}

function logInternalError(error: unknown) {
  // 운영 로그에는 분석에 필요한 오류 종류와 메시지만 남기고 토큰, 비밀번호,
  // 요청 본문처럼 민감할 수 있는 값은 공통 sanitizer로 제거합니다.
  const payload =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) };
  console.error("[jht-api-error]", sanitizeApiLogPayload(payload));
}

function publicErrorMessage(error: HttpError) {
  // 4xx는 사용자가 고칠 수 있는 입력/권한 오류라 메시지를 보여주고,
  // 5xx는 내부 오류라 일반 문구로 감춥니다.
  if (error.status >= 500) {
    return "Internal server error";
  }
  return error.message;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  const callerHeaders = Object.fromEntries(new Headers(init?.headers));

  return NextResponse.json(body, {
    ...init,
    headers: {
      ...callerHeaders,
      ...noStoreHeaders
    }
  });
}

export function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required`);
  }
  return value.trim();
}

export function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpError(400, "Expected string value");
  }
  return value.trim();
}

export function requireUuid(value: unknown, field: string) {
  const parsed = requireString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new HttpError(400, `${field} must be a UUID`);
  }
  return parsed;
}

export function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

export function requireArray<T = unknown>(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an array`);
  }
  return value as T[];
}

export function requireObject(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function supabaseError(error: { message?: string } | null, fallback = "Database operation failed") {
  if (error) {
    throw new HttpError(500, error.message ?? fallback);
  }
}

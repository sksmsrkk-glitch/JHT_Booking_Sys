import { NextResponse } from "next/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
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
    return jsonResponse({ error: publicErrorMessage(error) }, { status: error.status });
  }

  if (error instanceof Error) {
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  }

  return jsonResponse({ error: "Unknown error" }, { status: 500 });
}

function publicErrorMessage(error: HttpError) {
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

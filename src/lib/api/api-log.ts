import { sanitizeApiLogPayload } from "@/lib/domain/api-log.mjs";

export async function writeApiLog(
  supabase: any,
  input: {
    source: string;
    endpoint?: string | null;
    method?: string | null;
    statusCode?: number | null;
    requestPayload?: unknown;
    responsePayload?: unknown;
    idempotencyKey?: string | null;
  }
) {
  const { error } = await supabase.from("api_logs").insert({
    source: input.source,
    endpoint: input.endpoint ?? null,
    method: input.method ?? null,
    status_code: input.statusCode ?? null,
    request_payload: sanitizeApiLogPayload(input.requestPayload),
    response_payload: sanitizeApiLogPayload(input.responsePayload),
    idempotency_key: input.idempotencyKey ?? null
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

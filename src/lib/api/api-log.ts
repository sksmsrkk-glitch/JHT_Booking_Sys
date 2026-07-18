/**
 * @file 한글 책임: `api log` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
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

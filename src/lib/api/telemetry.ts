/**
 * @file 한글 책임: `telemetry` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
type ApiHandler<TArgs extends unknown[]> = (...args: TArgs) => Promise<Response>;

/**
 * API 응답에 요청 식별자와 서버 처리 시간을 기록합니다.
 * 설정한 임계값을 넘긴 요청만 JSON 로그로 남겨 대량 트래픽에서도 로그 비용을 통제합니다.
 */
export function instrumentApiRoute<TArgs extends [Request, ...unknown[]]>(
  routeName: string,
  handler: ApiHandler<TArgs>
): ApiHandler<TArgs> {
  return async (...args: TArgs) => {
    const request = args[0];
    const requestId = normalizeRequestId(request.headers.get("x-request-id")) ?? crypto.randomUUID();
    const startedAt = performance.now();
    const response = await handler(...args);
    const durationMs = Math.max(0, performance.now() - startedAt);

    response.headers.set("x-request-id", requestId);
    response.headers.set("server-timing", `app;dur=${durationMs.toFixed(1)}`);

    if (durationMs >= resolveSlowRequestThreshold()) {
      console.warn(
        JSON.stringify({
          event: "slow_api_request",
          requestId,
          route: routeName,
          method: request.method,
          status: response.status,
          durationMs: Number(durationMs.toFixed(1))
        })
      );
    }

    return response;
  };
}
function normalizeRequestId(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 100);
  return normalized || null;
}

function resolveSlowRequestThreshold() {
  const configured = Number(process.env.API_SLOW_REQUEST_MS ?? 750);
  return Number.isFinite(configured) && configured >= 50 ? configured : 750;
}

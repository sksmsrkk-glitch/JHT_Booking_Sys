/**
 * @file 한글 책임: `api log` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "secret",
  "token",
  "key",
  "password",
  "passport",
  "body",
  "bodyText",
  "providerPayload"
];

export function sanitizeApiLogPayload(value, depth = 0) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (depth > 4) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeApiLogPayload(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        if (isSensitiveKey(key)) return [key, "[redacted]"];
        return [key, sanitizeApiLogPayload(entryValue, depth + 1)];
      })
    );
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  return value;
}

function isSensitiveKey(key) {
  const normalized = String(key).toLowerCase();
  return REDACTED_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey.toLowerCase()));
}

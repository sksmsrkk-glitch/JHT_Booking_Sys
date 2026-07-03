import { createHash, timingSafeEqual } from "node:crypto";

import { HttpError } from "./http";

// 문자별 조기 종료로 인한 타이밍 사이드채널을 없애기 위해
// 양쪽을 해시한 뒤 고정 길이 버퍼로 비교합니다.
function secretsMatch(actual: string | null, expected: string) {
  if (typeof actual !== "string" || actual.length === 0) return false;
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function requireAutomationSecret(request: Request) {
  const expected = process.env.AUTOMATION_SECRET;
  if (!expected) {
    throw new HttpError(500, "AUTOMATION_SECRET is not configured");
  }

  if (!secretsMatch(request.headers.get("x-automation-secret"), expected)) {
    throw new HttpError(401, "Invalid automation secret");
  }
}

export function requireWebhookSecret(request: Request, envName: string) {
  const expected = process.env[envName];
  if (!expected) {
    throw new HttpError(500, `${envName} is not configured`);
  }

  if (!secretsMatch(request.headers.get("x-webhook-secret"), expected)) {
    throw new HttpError(401, "Invalid webhook secret");
  }
}

/**
 * 로그인 없이 UI를 눌러볼 수 있는 preview/demo 응답은 명시적 플래그가 켜졌고
 * 프로덕션이 아닐 때만 허용합니다. 그 외에는 인증 실패가 그대로 401/403으로
 * 전달되어 데이터가 조용히 유실되지 않게 합니다.
 */
export function isDemoModeEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.JHT_DEMO_MODE === "on";
}

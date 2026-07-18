/**
 * @file 한글 책임: `account recovery` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
import { createHash } from "node:crypto";

import { HttpError } from "@/lib/api/http";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const MAX_REQUESTS_PER_HOUR = 5;

export type RecoveryAccountType = "internal" | "agency";
export type RecoveryType = "email_lookup" | "password_reset";

/** IP 원문 대신 서버 비밀키로 해시한 값만 저장하여 복구 API의 반복 호출을 제한합니다. */
export async function createRecoveryFingerprint(request: Request, recoveryType: RecoveryType) {
  const clientAddress =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const secret = process.env.ACCOUNT_RECOVERY_RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local-only";
  const fingerprint = createHash("sha256").update(`${secret}:${recoveryType}:${clientAddress}`).digest("hex");
  const service = createServiceSupabaseClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await service
    .from("account_recovery_requests")
    .select("id", { count: "exact", head: true })
    .eq("request_fingerprint", fingerprint)
    .gte("created_at", since);

  if (error) throw new HttpError(500, "Unable to validate account recovery request");
  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    throw new HttpError(429, "Too many recovery requests. Please try again later.");
  }
  return fingerprint;
}

export function requireRecoveryAccountType(value: unknown): RecoveryAccountType {
  if (value === "internal" || value === "agency") return value;
  throw new HttpError(400, "accountType must be internal or agency");
}

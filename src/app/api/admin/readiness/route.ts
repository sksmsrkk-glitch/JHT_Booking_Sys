/**
 * @file 한글 책임: `/api/admin/readiness` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import {
  READINESS_SMOKE_TABLES,
  READINESS_STORAGE_CHECKS,
  buildReadinessReport,
  summarizeReadinessSmokeChecks,
  summarizeReadinessStorageChecks
} from "@/lib/domain/readiness.mjs";
import { createRequestSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);
    const report = buildReadinessReport(process.env);
    const { smokeChecks, storageChecks } = await runOperationalChecks();

    return ok({
      ...report,
      smokeChecks,
      smokeSummary: summarizeReadinessSmokeChecks(smokeChecks),
      storageChecks,
      storageSummary: summarizeReadinessStorageChecks(storageChecks)
    });
  } catch (error) {
    return fail(error);
  }
}

async function runOperationalChecks() {
  let serviceSupabase: ReturnType<typeof createServiceSupabaseClient>;
  try {
    serviceSupabase = createServiceSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service client could not be created";
    return {
      smokeChecks: READINESS_SMOKE_TABLES.map((check) => ({
        ...check,
        status: "skipped",
        error: message
      })),
      storageChecks: READINESS_STORAGE_CHECKS.map((check) => ({
        ...check,
        bucketName: process.env[check.bucketEnvName] || check.defaultBucket,
        status: "skipped",
        error: message
      }))
    };
  }

  const smokeChecks = await Promise.all(
    READINESS_SMOKE_TABLES.map(async (check) => {
      const { error } = await serviceSupabase.from(check.table).select("id").limit(1);
      return {
        ...check,
        status: error ? "failed" : "ready",
        error: error?.message ?? null
      };
    })
  );
  const storageChecks = await Promise.all(
    READINESS_STORAGE_CHECKS.map(async (check) => {
      const bucketName = process.env[check.bucketEnvName] || check.defaultBucket;
      const { error } = await serviceSupabase.storage.getBucket(bucketName);
      return {
        ...check,
        bucketName,
        status: error ? "failed" : "ready",
        error: error?.message ?? null
      };
    })
  );

  return { smokeChecks, storageChecks };
}

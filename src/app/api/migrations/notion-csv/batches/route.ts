/**
 * @file 한글 책임: `/api/migrations/notion-csv/batches` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listMigrationBatches } from "@/features/migration/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const batches = await listMigrationBatches(supabase, {
      status: url.searchParams.get("status") ?? undefined,
      targetTable: url.searchParams.get("targetTable") ?? undefined
    });

    return ok(batches);
  } catch (error) {
    return fail(error);
  }
}

/**
 * @file 한글 책임: `/api/agency/invoices` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listAgencyInvoicePage } from "@/features/agency-portal/queries";
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, okPaginated } from "@/lib/api/http";
import { parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/agency/invoices", async (request: Request) => {
  try {
    const pagination = parsePagination(new URL(request.url).searchParams);
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const invoices = await listAgencyInvoicePage(supabase, agencyUser.agencyAccountId, pagination);
    return okPaginated(invoices.items, invoices.pagination);
  } catch (error) {
    return fail(error);
  }
});

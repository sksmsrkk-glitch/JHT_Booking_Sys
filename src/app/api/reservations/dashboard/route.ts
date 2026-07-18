/**
 * @file 한글 책임: `/api/reservations/dashboard` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { getReservationDashboard, listReservationCalendar } from "@/features/reservation/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { instrumentApiRoute } from "@/lib/api/telemetry";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const GET = instrumentApiRoute("GET /api/reservations/dashboard", async (request: Request) => {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);
    const url = new URL(request.url);
    const month = normalizeMonth(url.searchParams.get("month"));
    const filters = {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    };
    const { start, end } = monthRange(month);
    const [dashboard, calendar] = await Promise.all([
      getReservationDashboard(supabase, { ...filters, monthStart: start }),
      listReservationCalendar(supabase, filters, { start, end, maxItems: 250 })
    ]);

    return ok({
      ...dashboard,
      calendar: calendar.items,
      calendarPagination: calendar.pagination,
      month
    });
  } catch (error) {
    return fail(error);
  }
});

function normalizeMonth(value: string | null) {
  if (!value) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new HttpError(400, "month must use YYYY-MM format");
  return value;
}
function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const end = `${year}-${String(monthNumber).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;
  return { start, end };
}

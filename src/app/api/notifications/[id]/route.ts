/**
 * @file 한글 책임: `/api/notifications/[id]` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 내부 운영자가 대기 중 알림을 확인(acknowledge)해 처리 완료로 표시하고, 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, readJson, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = ["read", "dismissed"];

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const notificationId = requireUuid(id, "id");
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);

    const nextStatus = typeof body.status === "string" ? body.status : "read";
    if (!ALLOWED_STATUSES.includes(nextStatus)) {
      throw new HttpError(400, "status must be read or dismissed");
    }

    // 이미 확인된 알림을 다시 확인 상태로 되돌리지 않도록 대기 상태에서만 전환합니다.
    const { data, error } = await supabase
      .from("notifications")
      .update({ status: nextStatus })
      .eq("id", notificationId)
      .in("status", ["queued", "sent"])
      .select("id, status")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(409, "Notification is already acknowledged or does not exist");

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

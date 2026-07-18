import { requireAgencyUser } from "@/lib/api/auth";
import { created, fail, HttpError, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const agencyUser = await requireAgencyUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);

    // 문의와 감사 로그를 DB 함수 한 트랜잭션에서 생성해 RLS로 인한 부분 쓰기를 막습니다.
    const { data: result, error } = await supabase.rpc("submit_agency_quote_request_atomic", {
      p_agency_account_id: agencyUser.agencyAccountId,
      p_agency_user_id: agencyUser.agencyUserId,
      p_quote_case_id: id,
      p_inquiry_type: "booking_request",
      p_title: null,
      p_message: requireString(body.message, "message"),
      p_requested_changes: [],
      p_quote_version_id: typeof body.acceptedQuoteVersionId === "string" ? body.acceptedQuoteVersionId : null,
      p_agency_reference_no: typeof body.agencyReferenceNo === "string" ? body.agencyReferenceNo : null,
      p_idempotency_key: request.headers.get("idempotency-key")?.trim() || null
    });
    if (error) throwRpcError(error);
    if (!result?.inquiry?.id) throw new HttpError(500, "Booking request was not returned");
    return created({ ...result.inquiry, existing: Boolean(result.existing) });
  } catch (error) {
    return fail(error);
  }
}

function throwRpcError(error: { code?: string; message: string }): never {
  const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : ["22023", "23505"].includes(error.code ?? "") ? 409 : 500;
  throw new HttpError(status, error.message);
}

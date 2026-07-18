/**
 * @file 한글 책임: `/api/automation/gmail-review/[id]` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { writeAuditLog } from "@/lib/api/audit";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, HttpError, ok, optionalString, readJson } from "@/lib/api/http";
import {
  buildGmailThreadManualLinkUpdate,
  buildGmailThreadManualReviewUpdate
} from "@/lib/domain/gmail-review.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteParams = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: RouteParams }) {
  try {
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const action = optionalString(body.action) ?? "link";

    const { data: before, error: beforeError } = await supabase
      .from("email_threads")
      .select("id, gmail_thread_id, quote_case_id, reservation_id, agency_account_id, requires_manual_review, match_confidence")
      .eq("id", id)
      .maybeSingle();

    if (beforeError) throw new HttpError(500, beforeError.message);
    if (!before) throw new HttpError(404, "Gmail review thread not found");

    if (action === "unlink") {
      const updatePlan = buildGmailThreadManualReviewUpdate({ actorProfileId: internalUser.profileId });
      const updatedThread = await updateEmailThread(supabase, id, updatePlan.update);
      await auditGmailReviewUpdate(supabase, {
        before,
        updatedThread,
        audit: updatePlan.audit
      });
      return ok(updatedThread);
    }

    if (action !== "link") {
      throw new HttpError(400, "Unsupported Gmail review action");
    }

    const quoteCaseId = optionalString(body.quoteCaseId);
    const reservationId = optionalString(body.reservationId);
    const linkTarget = await resolveLinkTarget(supabase, { quoteCaseId, reservationId });
    const updatePlan = buildGmailThreadManualLinkUpdate({
      quoteCaseId: linkTarget.quoteCaseId,
      reservationId: linkTarget.reservationId,
      agencyAccountId: linkTarget.agencyAccountId,
      actorProfileId: internalUser.profileId
    });

    const updatedThread = await updateEmailThread(supabase, id, updatePlan.update);
    await auditGmailReviewUpdate(supabase, {
      before,
      updatedThread,
      audit: updatePlan.audit
    });

    return ok(updatedThread);
  } catch (error) {
    return fail(error);
  }
}

async function resolveLinkTarget(
  supabase: any,
  { quoteCaseId, reservationId }: { quoteCaseId: string | null; reservationId: string | null }
) {
  if (!quoteCaseId && !reservationId) {
    throw new HttpError(400, "quoteCaseId or reservationId is required");
  }

  const quoteCase = quoteCaseId ? await loadQuoteCase(supabase, quoteCaseId) : null;
  const reservation = reservationId ? await loadReservation(supabase, reservationId) : null;

  if (quoteCase && reservation) {
    if (reservation.quote_case_id !== quoteCase.id) {
      throw new HttpError(409, "Selected reservation does not belong to selected quote case");
    }
    if (reservation.agency_account_id !== quoteCase.agency_account_id) {
      throw new HttpError(409, "Selected reservation and quote case belong to different agencies");
    }
  }

  return {
    quoteCaseId: quoteCase?.id ?? reservation?.quote_case_id ?? null,
    reservationId: reservation?.id ?? null,
    agencyAccountId: quoteCase?.agency_account_id ?? reservation?.agency_account_id
  };
}

async function loadQuoteCase(supabase: any, quoteCaseId: string) {
  const { data, error } = await supabase
    .from("quote_cases")
    .select("id, agency_account_id")
    .eq("id", quoteCaseId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Selected quote case not found");
  return data;
}

async function loadReservation(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, quote_case_id, agency_account_id")
    .eq("id", reservationId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Selected reservation not found");
  return data;
}

async function updateEmailThread(supabase: any, id: string, update: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("email_threads")
    .update(update)
    .eq("id", id)
    .select("id, gmail_thread_id, quote_case_id, reservation_id, agency_account_id, requires_manual_review, match_confidence, updated_at")
    .single();

  if (error) throw new HttpError(500, error.message);
  return data;
}

async function auditGmailReviewUpdate(
  supabase: any,
  {
    before,
    updatedThread,
    audit
  }: {
    before: Record<string, unknown>;
    updatedThread: Record<string, unknown>;
    audit: {
      actorProfileId: string;
      action: string;
      riskLevel: string;
      afterData: Record<string, unknown>;
    };
  }
) {
  await writeAuditLog(supabase, {
    actorProfileId: audit.actorProfileId,
    action: audit.action,
    entityTable: "email_threads",
    entityId: String(updatedThread.id),
    riskLevel: audit.riskLevel === "high" ? "high" : "normal",
    beforeData: before,
    afterData: { ...audit.afterData, thread: updatedThread }
  });
}

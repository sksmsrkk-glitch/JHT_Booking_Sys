/**
 * @file 한글 책임: `gmail review` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
export function buildGmailThreadManualLinkUpdate({
  quoteCaseId,
  reservationId,
  agencyAccountId,
  actorProfileId
}, now = new Date()) {
  if (!quoteCaseId && !reservationId) {
    throw new Error("quoteCaseId or reservationId is required");
  }
  if (!agencyAccountId) {
    throw new Error("agencyAccountId is required");
  }
  if (!actorProfileId) {
    throw new Error("actorProfileId is required");
  }
  if (Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid date");
  }

  return {
    update: {
      quote_case_id: quoteCaseId ?? null,
      reservation_id: reservationId ?? null,
      agency_account_id: agencyAccountId,
      requires_manual_review: false,
      match_confidence: 1
    },
    audit: {
      actorProfileId,
      action: "gmail_thread.manual_linked",
      riskLevel: "normal",
      afterData: {
        quoteCaseId: quoteCaseId ?? null,
        reservationId: reservationId ?? null,
        agencyAccountId,
        reviewedAt: now.toISOString()
      }
    }
  };
}

export function buildGmailThreadManualReviewUpdate({ actorProfileId }, now = new Date()) {
  if (!actorProfileId) {
    throw new Error("actorProfileId is required");
  }
  if (Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid date");
  }

  return {
    update: {
      quote_case_id: null,
      reservation_id: null,
      agency_account_id: null,
      requires_manual_review: true,
      match_confidence: 0
    },
    audit: {
      actorProfileId,
      action: "gmail_thread.manual_unlinked",
      riskLevel: "normal",
      afterData: {
        reviewedAt: now.toISOString()
      }
    }
  };
}

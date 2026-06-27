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

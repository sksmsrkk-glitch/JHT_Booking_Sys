export function buildGmailThreadManualLinkUpdate(input: {
  quoteCaseId?: string | null;
  reservationId?: string | null;
  agencyAccountId: string;
  actorProfileId: string;
}, now?: Date): {
  update: {
    quote_case_id: string | null;
    reservation_id: string | null;
    agency_account_id: string;
    requires_manual_review: false;
    match_confidence: 1;
  };
  audit: {
    actorProfileId: string;
    action: "gmail_thread.manual_linked";
    riskLevel: "normal";
    afterData: {
      quoteCaseId: string | null;
      reservationId: string | null;
      agencyAccountId: string;
      reviewedAt: string;
    };
  };
};

export function buildGmailThreadManualReviewUpdate(input: {
  actorProfileId: string;
}, now?: Date): {
  update: {
    quote_case_id: null;
    reservation_id: null;
    agency_account_id: null;
    requires_manual_review: true;
    match_confidence: 0;
  };
  audit: {
    actorProfileId: string;
    action: "gmail_thread.manual_unlinked";
    riskLevel: "normal";
    afterData: {
      reviewedAt: string;
    };
  };
};

/**
 * @file 한글 책임: `gmail review` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
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

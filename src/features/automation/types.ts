/**
 * @file 한글 책임: `automation` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type GmailReviewItem = {
  id: string;
  gmailThreadId: string;
  quoteCaseId: string | null;
  caseCode: string | null;
  tourName: string | null;
  reservationId: string | null;
  reservationCode: string | null;
  agencyName: string | null;
  matchConfidence: number | null;
  requiresManualReview: boolean;
  messageCount: number;
  latestSubject: string | null;
  latestFromEmail: string | null;
  latestReceivedAt: string | null;
  matchCandidates: GmailMatchCandidate[];
  createdAt: string;
};

export type GmailReviewFilters = {
  review?: string;
};

export type GmailMatchCandidate = {
  id: string;
  quoteCaseId: string;
  caseCode: string | null;
  tourName: string | null;
  agencyName: string | null;
  score: number;
  reasons: string[];
  requiresManualReview: boolean;
  updatedAt: string;
};

export type FailedAutomationJob =
  | {
      id: string;
      kind: "supplier_message";
      title: string;
      status: "failed";
      errorMessage: string | null;
      createdAt: string;
      failedAt: string | null;
      detailHref: string;
      retryLabel: "Requeue";
      supplierMessage: {
        id: string;
        messageType: string;
        status: string;
        channel: string;
        riskLevel: string;
        approvedAt: string | null;
        secondApprovedAt: string | null;
        reservationCode: string | null;
        supplierName: string | null;
      };
      quoteExport?: never;
    }
  | {
      id: string;
      kind: "quote_export";
      title: string;
      status: "failed";
      errorMessage: string | null;
      createdAt: string;
      failedAt: string | null;
      detailHref: string;
      retryLabel: "Retry";
      quoteExport: {
        id: string;
        exportType: string;
        storagePath: string | null;
        quoteVersionId: string;
        quoteCaseId: string | null;
        caseCode: string | null;
        tourName: string | null;
        versionNo: number | null;
      };
      supplierMessage?: never;
    };

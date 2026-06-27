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

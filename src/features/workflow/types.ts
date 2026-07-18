/**
 * @file 한글 책임: `workflow` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type WorkflowThreadSummary = {
  id: string;
  workflowCode: string;
  title: string;
  status: string;
  agencyAccountId: string | null;
  agencyName: string | null;
  agencyInquiryId: string | null;
  quoteCaseId: string | null;
  reservationId: string | null;
  currentInvoiceId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
};

export type WorkflowMessage = {
  id: string;
  threadId: string;
  senderType: "agency" | "internal" | "system";
  senderProfileId: string | null;
  senderAgencyUserId: string | null;
  senderName: string | null;
  senderEmail: string | null;
  messageType: string;
  body: string;
  visibility: "partner_visible" | "internal_only";
  linkedQuoteVersionId: string | null;
  linkedInvoiceId: string | null;
  createdAt: string;
};

export type WorkflowActionItem = {
  id: string;
  threadId: string;
  sourceMessageId: string | null;
  category: string;
  title: string;
  details: string | null;
  status: string;
  partnerVisible: boolean;
  linkedQuoteVersionId: string | null;
  assignedTo: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type WorkflowThreadDetail = WorkflowThreadSummary & {
  messages: WorkflowMessage[];
  actionItems: WorkflowActionItem[];
  linkedDocs: {
    inquiryId: string | null;
    quoteCaseId: string | null;
    reservationId: string | null;
    invoiceId: string | null;
  };
};

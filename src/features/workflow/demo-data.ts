import type { WorkflowThreadDetail } from "./types";

const now = "2026-06-30T09:00:00+09:00";

export const demoWorkflowThreads: WorkflowThreadDetail[] = [
  {
    id: "workflow-preview-thailand-oct",
    workflowCode: "Q-2026-TH-001",
    title: "Thailand arrival Seoul 4N - Pete",
    status: "waiting_internal",
    agencyAccountId: "agency-preview-thailand-oct",
    agencyName: "Thailand Partner",
    agencyInquiryId: "inquiry-preview-thailand-oct",
    quoteCaseId: "quote-preview-thailand-oct",
    reservationId: "preview-thailand-oct",
    currentInvoiceId: null,
    lastMessageAt: now,
    createdAt: "2026-06-21T09:00:00+09:00",
    linkedDocs: {
      inquiryId: "inquiry-preview-thailand-oct",
      quoteCaseId: "quote-preview-thailand-oct",
      reservationId: "preview-thailand-oct",
      invoiceId: null
    },
    messages: [
      {
        id: "msg-preview-1",
        threadId: "workflow-preview-thailand-oct",
        senderType: "agency",
        senderProfileId: null,
        senderAgencyUserId: "11111111-1111-4111-8111-111111111111",
        senderName: "Jaime",
        senderEmail: "jaime.yap@worldtravellers-dmc.com",
        messageType: "quote_revision",
        body:
          "Please requote the programme. Client prefers super VIP coach 2+1 seater x 2 units, D2 dinner should be hotel buffet, and inspection cost for 2 persons is required.",
        visibility: "partner_visible",
        linkedQuoteVersionId: null,
        linkedInvoiceId: null,
        createdAt: "2026-06-18T01:29:00+09:00"
      },
      {
        id: "msg-preview-2",
        threadId: "workflow-preview-thailand-oct",
        senderType: "internal",
        senderProfileId: "22222222-2222-4222-8222-222222222222",
        senderAgencyUserId: null,
        senderName: "Issac / Suki",
        senderEmail: null,
        messageType: "operation_update",
        body:
          "Revised quotation is being prepared. Check hotel buffet availability, VIP coach supply, inspection MPV usage, and crew cost before sending the next version.",
        visibility: "partner_visible",
        linkedQuoteVersionId: null,
        linkedInvoiceId: null,
        createdAt: now
      },
      {
        id: "msg-preview-3",
        threadId: "workflow-preview-thailand-oct",
        senderType: "internal",
        senderProfileId: "22222222-2222-4222-8222-222222222222",
        senderAgencyUserId: null,
        senderName: "Internal note",
        senderEmail: null,
        messageType: "operation_update",
        body:
          "Before final confirmation, verify whether breakfast at Inspire should be changed to Lotte Hotel breakfast or pre-night immediate check-in option.",
        visibility: "internal_only",
        linkedQuoteVersionId: null,
        linkedInvoiceId: null,
        createdAt: now
      }
    ],
    actionItems: [
      {
        id: "action-preview-hotel",
        threadId: "workflow-preview-thailand-oct",
        sourceMessageId: "msg-preview-1",
        category: "hotel",
        title: "Check pre-night Lotte Seoul Deluxe room with breakfast",
        details: "Need rate with and without breakfast for immediate check-in after arrival.",
        status: "open",
        partnerVisible: true,
        linkedQuoteVersionId: null,
        assignedTo: null,
        dueAt: null,
        resolvedAt: null,
        createdAt: now
      },
      {
        id: "action-preview-meal",
        threadId: "workflow-preview-thailand-oct",
        sourceMessageId: "msg-preview-1",
        category: "meal",
        title: "Change D2 dinner to hotel buffet",
        details: "Partner requested hotel buffet for D2 dinner in the revised quotation.",
        status: "in_progress",
        partnerVisible: true,
        linkedQuoteVersionId: null,
        assignedTo: null,
        dueAt: null,
        resolvedAt: null,
        createdAt: now
      },
      {
        id: "action-preview-vehicle",
        threadId: "workflow-preview-thailand-oct",
        sourceMessageId: "msg-preview-1",
        category: "vehicle",
        title: "Quote super VIP coach 2+1 seater x 2 units",
        details: "Client does not want sprinter van.",
        status: "open",
        partnerVisible: true,
        linkedQuoteVersionId: null,
        assignedTo: null,
        dueAt: null,
        resolvedAt: null,
        createdAt: now
      },
      {
        id: "action-preview-inspection",
        threadId: "workflow-preview-thailand-oct",
        sourceMessageId: "msg-preview-1",
        category: "inspection",
        title: "Add inspection cost for 2 persons",
        details: "3 days MPV usage, one-way airport transfer, Lotte Seoul rooms, sightseeing, and meals.",
        status: "open",
        partnerVisible: true,
        linkedQuoteVersionId: null,
        assignedTo: null,
        dueAt: null,
        resolvedAt: null,
        createdAt: now
      }
    ]
  }
];

export function getDemoWorkflowByCode(workflowCode: string) {
  const normalized = workflowCode.toUpperCase();
  return (
    demoWorkflowThreads.find((thread) => thread.workflowCode.toUpperCase() === normalized) ??
    demoWorkflowThreads.find((thread) => thread.reservationId === workflowCode) ??
    null
  );
}

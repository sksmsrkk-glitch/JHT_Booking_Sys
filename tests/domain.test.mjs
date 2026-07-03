import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuoteItem, buildQuoteSnapshot } from "../src/lib/domain/quotation.mjs";
import {
  assertOperationTaskReminderAllowed,
  assertReservationOperationsOpen,
  buildOperationTaskUpdate,
  buildReminderCandidates,
  createDefaultOperationTasks
} from "../src/lib/domain/operations.mjs";
import {
  assertSupplierMessageDraftAllowed,
  assertSupplierMessageCanSend,
  buildSupplierMessageDeliveryAttempt,
  buildSupplierMessageRequeueUpdate,
  buildDefaultSupplierMessageTemplate,
  buildSupplierProviderCallbackUpdate,
  buildSupplierMessageDraft
} from "../src/lib/domain/supplier-messages.mjs";
import { scoreGmailMatch } from "../src/lib/domain/gmail-match.mjs";
import { parseRoomingListText } from "../src/lib/domain/rooming-list.mjs";
import {
  assertFinanceAdjustmentAllowed,
  assertFinanceEntryAllowed,
  buildSettlementStatusUpdate,
  summarizeInvoicePayments
} from "../src/lib/domain/finance.mjs";
import {
  buildFinanceExpenseRowsFromGuideReport,
  summarizeGuideExpenseReport
} from "../src/lib/domain/guide-expenses.mjs";
import { buildInvoiceFromFinalQuote } from "../src/features/finance/auto-invoice.ts";
import {
  READINESS_SMOKE_TABLES,
  buildReadinessReport,
  summarizeReadinessLaunchChecks,
  summarizeReadinessSmokeChecks,
  summarizeReadinessStorageChecks,
  summarizeReadinessWorkflowChecks
} from "../src/lib/domain/readiness.mjs";
import { buildMigrationImportRows, buildMigrationStatusUpdate, validateMigrationRows } from "../src/lib/domain/migration.mjs";
import {
  buildNotionMarkdownImportPlan,
  buildSupplierCostMasterFromNotionDocument,
  parseNotionMarkdownDocument
} from "../src/lib/domain/notion-markdown-import.mjs";
import {
  assertBootstrapAllowed,
  buildInitialAdminBootstrapRows,
  buildInitialCompanyBootstrapRow
} from "../src/lib/domain/bootstrap.mjs";
import {
  buildGmailThreadManualLinkUpdate,
  buildGmailThreadManualReviewUpdate
} from "../src/lib/domain/gmail-review.mjs";
import {
  planReservationStatusChange,
  RESERVATION_STATUSES as RESERVATION_STATUS_LIST
} from "../src/lib/domain/reservations.mjs";
import { computeSettlementTotals, selectActiveInvoices, roundMoney } from "../src/lib/domain/settlement.mjs";
import { resolveInvoicePaymentState, validatePaymentInput } from "../src/lib/domain/payments.mjs";
import { convertKrwToQuoteCurrency } from "../src/lib/domain/currency.mjs";
import { buildCompanyCreateRow } from "../src/lib/domain/company.mjs";
import { buildInternalProfileRow, buildInternalUserRoleRows, normalizeRoles } from "../src/lib/domain/internal-users.mjs";
import {
  buildQuoteExportRequest,
  buildQuoteExportRetryUpdate,
  buildQuoteExportSnapshotSummary
} from "../src/lib/domain/quote-export.mjs";
import { createXlsxBuffer, buildQuoteExportWorkbook } from "../src/lib/domain/xlsx.mjs";
import { sanitizeApiLogPayload } from "../src/lib/domain/api-log.mjs";
import { listFailedAutomationJobs } from "../src/features/automation/queries.ts";

test("quote item stores supplier cost snapshot and supports positive margin", () => {
  const snapshot = buildQuoteSnapshot({
    productId: "product-1",
    priceId: "price-1",
    productName: "Lotte Hotel Busan Twin",
    supplierName: "Lotte Hotel Busan",
    currency: "KRW",
    unitCostAmount: 200000,
    exchangeRateToKrw: 1
  });

  const result = calculateQuoteItem({
    ...snapshot,
    pricingUnit: "per_room",
    quantity: 10,
    paxCount: 20,
    margin: { mode: "auto_rate", rate: 0.15 }
  });

  assert.equal(result.totalCostKrw, 2000000);
  assert.equal(result.totalSellAmount, 2300000);
  assert.equal(result.marginAmount, 300000);
  assert.equal(result.snapshotItemName, "Lotte Hotel Busan Twin");
});

test("quote item supports negative margin for business-approved loss leaders", () => {
  const result = calculateQuoteItem({
    snapshotItemName: "Shopping-driven package subsidy",
    snapshotSupplierName: "Internal",
    unitCostAmount: 1000000,
    pricingUnit: "per_group",
    quantity: 1,
    margin: { mode: "auto_rate", rate: -0.1 }
  });

  assert.equal(result.totalSellAmount, 900000);
  assert.equal(result.marginAmount, -100000);
});

test("operation task generator creates team-specific reservation tasks", () => {
  const tasks = createDefaultOperationTasks({
    reservationId: "reservation-1",
    tourStartDate: "2026-06-16T00:00:00.000Z",
    createdBy: "user-1"
  });

  assert.equal(tasks.length, 7);
  assert.equal(tasks[0].team, "sales");
  assert.equal(tasks.some((task) => task.team === "finance"), true);
});

test("reminder candidates include stable idempotency keys", () => {
  const candidates = buildReminderCandidates({
    now: "2026-06-14T00:00:00.000Z",
    tasks: [
      {
        id: "task-1",
        reservation_id: "reservation-1",
        status: "todo",
        due_at: "2026-06-15T12:00:00.000Z"
      }
    ]
  });

  assert.equal(candidates[0].ruleCode, "due_48h");
  assert.equal(candidates[0].idempotencyKey, "reservation-1:task-1:due_48h:2026-06-14");
});

test("operation task reminders exclude terminal task statuses", () => {
  const candidates = buildReminderCandidates({
    now: "2026-06-14T00:00:00.000Z",
    tasks: [
      {
        id: "task-done",
        reservation_id: "reservation-1",
        status: "done",
        due_at: "2026-06-15T12:00:00.000Z"
      },
      {
        id: "task-cancelled",
        reservation_id: "reservation-1",
        status: "cancelled",
        due_at: "2026-06-15T12:00:00.000Z"
      }
    ]
  });

  assert.deepEqual(candidates, []);
  assert.equal(assertOperationTaskReminderAllowed({ taskStatus: "todo" }), true);
  assert.throws(() => assertOperationTaskReminderAllowed({ taskStatus: "done" }));
  assert.throws(() => assertOperationTaskReminderAllowed({ taskStatus: "cancelled" }));
});

test("operation task update validates blocked reason and completion timestamp", () => {
  assert.throws(() => buildOperationTaskUpdate({ status: "blocked", blockedReason: "" }));

  const doneUpdate = buildOperationTaskUpdate(
    { status: "done", blockedReason: "waiting", dueAt: "2026-06-15T09:00" },
    new Date("2026-06-10T00:00:00.000Z")
  );

  assert.equal(doneUpdate.status, "done");
  assert.equal(doneUpdate.completed_at, "2026-06-10T00:00:00.000Z");
  assert.equal(doneUpdate.blocked_reason, null);
  assert.equal(doneUpdate.due_at, "2026-06-15T00:00:00.000Z");
});

test("reservation operations lock after cancellation or completion", () => {
  assert.equal(assertReservationOperationsOpen({ reservationStatus: "confirmed" }), true);
  assert.equal(assertReservationOperationsOpen({ reservationStatus: "on_tour" }), true);
  assert.throws(() => assertReservationOperationsOpen({ reservationStatus: "cancelled" }));
  assert.throws(() => assertReservationOperationsOpen({ reservationStatus: "completed" }));
});

test("supplier messages are draft-first and cancellation requires second approval", () => {
  const draft = buildSupplierMessageDraft({
    reservationId: "reservation-1",
    domesticSupplierId: "supplier-1",
    messageType: "cancellation_request",
    channel: "email",
    revisionNo: 2,
    subjectTemplate: "Cancel {{reservation.code}}",
    bodyTemplate: "Please cancel {{reservation.code}}.",
    data: { reservation: { code: "JHT-2026-001" } }
  });

  assert.equal(draft.subject, "Cancel JHT-2026-001");
  assert.equal(draft.risk_level, "high");
  assert.throws(() =>
    assertSupplierMessageCanSend({
      ...draft,
      approved_by: "manager-1",
      approved_at: "2026-05-10T00:00:00.000Z"
    })
  );
});

test("supplier message drafts are locked after reservation cancellation or completion", () => {
  assert.equal(assertSupplierMessageDraftAllowed({ reservationStatus: "confirmed" }), true);
  assert.equal(assertSupplierMessageDraftAllowed({ reservationStatus: "on_tour" }), true);
  assert.throws(() => assertSupplierMessageDraftAllowed({ reservationStatus: "cancelled" }));
  assert.throws(() => assertSupplierMessageDraftAllowed({ reservationStatus: "completed" }));
});

test("supplier message default template renders reservation and supplier context", () => {
  const template = buildDefaultSupplierMessageTemplate({
    messageType: "booking_request",
    data: {
      reservation: {
        code: "JHT-2026-001",
        tourName: "Busan Incentive",
        startDate: "2026-07-01",
        endDate: "2026-07-03"
      },
      agency: { name: "World Travellers" },
      supplier: { name: "Lotte Hotel Busan" }
    }
  });

  assert.match(template.subject, /JHT-2026-001/);
  assert.match(template.body, /Lotte Hotel Busan/);
  assert.match(template.body, /2026-07-01 - 2026-07-03/);
  assert.doesNotMatch(template.body, /\{\{/);
});

test("supplier provider callback updates outbox state from provider events", () => {
  const sentUpdate = buildSupplierProviderCallbackUpdate({
    eventType: "delivered",
    providerMessageId: "provider-1",
    occurredAt: "2026-06-20T12:00:00.000Z"
  });

  assert.equal(sentUpdate.status, "sent");
  assert.equal(sentUpdate.provider_message_id, "provider-1");
  assert.equal(sentUpdate.sent_at, "2026-06-20T12:00:00.000Z");
  assert.equal(sentUpdate.error_message, null);

  const failedUpdate = buildSupplierProviderCallbackUpdate({
    eventType: "failed",
    errorMessage: "Mailbox unavailable"
  });

  assert.equal(failedUpdate.status, "failed");
  assert.equal(failedUpdate.error_message, "Mailbox unavailable");
  assert.throws(() => buildSupplierProviderCallbackUpdate({ eventType: "unknown" }));
});

test("supplier message delivery worker builds dry-run and live provider attempts", () => {
  const message = {
    id: "message-1",
    status: "queued",
    channel: "email",
    message_type: "booking_request",
    subject: "Booking request",
    idempotency_key: "reservation-1:supplier-1:booking_request:email:1",
    approved_by: "manager-1",
    approved_at: "2026-06-26T00:00:00.000Z"
  };

  const dryRun = buildSupplierMessageDeliveryAttempt({
    message,
    env: { SUPPLIER_MESSAGE_DELIVERY_MODE: "dry_run" },
    now: new Date("2026-06-26T01:00:00.000Z")
  });

  assert.equal(dryRun.provider, "email_dry_run");
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.sendingUpdate.status, "sending");
  assert.equal(dryRun.finalUpdate.status, "sent");
  assert.match(dryRun.finalUpdate.provider_message_id, /^email_dry_run:/);
  assert.equal(dryRun.finalEvent.provider_payload.dryRun, true);

  const live = buildSupplierMessageDeliveryAttempt({
    message,
    env: { SUPPLIER_MESSAGE_DELIVERY_MODE: "live", EMAIL_PROVIDER_NAME: "postmark" },
    now: "2026-06-26T01:00:00.000Z"
  });

  assert.equal(live.provider, "postmark");
  assert.equal(live.dryRun, false);
  assert.throws(() =>
    buildSupplierMessageDeliveryAttempt({
      message: { ...message, status: "draft" },
      env: { SUPPLIER_MESSAGE_DELIVERY_MODE: "dry_run" }
    })
  );
  assert.throws(() =>
    buildSupplierMessageDeliveryAttempt({
      message: { ...message, channel: "kakao_alimtalk" },
      env: { SUPPLIER_MESSAGE_DELIVERY_MODE: "live" }
    })
  );
});

test("failed supplier messages can be requeued after approval", () => {
  const update = buildSupplierMessageRequeueUpdate({
    id: "message-1",
    status: "failed",
    approved_by: "manager-1",
    approved_at: "2026-06-26T00:00:00.000Z",
    message_type: "booking_request",
    error_message: "Provider timeout"
  });

  assert.deepEqual(update, { status: "queued", error_message: null });
  assert.throws(() =>
    buildSupplierMessageRequeueUpdate({
      id: "message-1",
      status: "sent",
      approved_by: "manager-1",
      approved_at: "2026-06-26T00:00:00.000Z",
      message_type: "booking_request"
    })
  );
  assert.throws(() =>
    buildSupplierMessageRequeueUpdate({
      id: "message-1",
      status: "failed",
      message_type: "booking_request"
    })
  );
});

test("gmail matcher requires manual review below confidence threshold", () => {
  const match = scoreGmailMatch({
    message: {
      subject: "RE: [23] Jungho Travel / Manulife Investment MY Challenge Busan 2026",
      body: "Latest rooming list attached",
      from: "carolyn.hoo@worldtravellers-dmc.com",
      threadId: "gmail-thread-1"
    },
    quoteCase: {
      caseCode: "JHT-2026-023",
      tourName: "Manulife Investment MY Challenge Busan 2026",
      gmailThreadId: "gmail-thread-1"
    },
    agency: {
      emailDomain: "worldtravellers-dmc.com"
    }
  });

  assert.equal(match.score, 0.45);
  assert.equal(match.requiresManualReview, true);
  assert.deepEqual(match.reasons, ["thread_id_exact", "agency_email_domain", "tour_name_reference"]);
});

test("gmail manual review links and unlinks with audit evidence", () => {
  const linked = buildGmailThreadManualLinkUpdate(
    {
      quoteCaseId: "quote-1",
      reservationId: "reservation-1",
      agencyAccountId: "agency-1",
      actorProfileId: "00000000-0000-4000-8000-000000000005"
    },
    new Date("2026-06-26T00:00:00.000Z")
  );

  assert.equal(linked.update.quote_case_id, "quote-1");
  assert.equal(linked.update.reservation_id, "reservation-1");
  assert.equal(linked.update.requires_manual_review, false);
  assert.equal(linked.update.match_confidence, 1);
  assert.equal(linked.audit.action, "gmail_thread.manual_linked");
  assert.equal(linked.audit.afterData.reviewedAt, "2026-06-26T00:00:00.000Z");

  const unlinked = buildGmailThreadManualReviewUpdate({
    actorProfileId: "00000000-0000-4000-8000-000000000005"
  });
  assert.equal(unlinked.update.quote_case_id, null);
  assert.equal(unlinked.update.requires_manual_review, true);
  assert.equal(unlinked.audit.action, "gmail_thread.manual_unlinked");
  assert.throws(() =>
    buildGmailThreadManualLinkUpdate({
      quoteCaseId: null,
      reservationId: null,
      agencyAccountId: "agency-1",
      actorProfileId: "00000000-0000-4000-8000-000000000005"
    })
  );
});

test("rooming list parser maps CSV headers into passenger rows", () => {
  const result = parseRoomingListText(`Passenger No,Passenger Name,Gender,DOB,Dietary,Passport No,Coach
1,"Hong, Gil Dong",M,01/15/1990,Vegetarian,M1234567,A
2,Kim Hana,F,1992-03-20,,M7654321,B`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.passengers.length, 2);
  assert.equal(result.passengers[0].fullName, "Hong, Gil Dong");
  assert.equal(result.passengers[0].dateOfBirth, "1990-01-15");
  assert.equal(result.passengers[0].dietaryRequirements, "Vegetarian");
  assert.equal(result.passengers[1].coachLabel, "B");
});

test("rooming list parser supports tab-delimited agency spreadsheets", () => {
  const result = parseRoomingListText("No\tName\tSex\tMeal Request\n\tLee Min Jae\tM\tNo pork");

  assert.deepEqual(result.errors, []);
  assert.equal(result.passengers[0].passengerNo, "1");
  assert.equal(result.passengers[0].gender, "M");
  assert.equal(result.passengers[0].dietaryRequirements, "No pork");
});

test("invoice payment summary counts confirmed payments toward balance only", () => {
  const summary = summarizeInvoicePayments({
    totalAmount: 1000,
    payments: [
      { status: "confirmed", amount: 400 },
      { status: "pending", amount: 300 },
      { status: "failed", amount: 900 }
    ]
  });

  assert.equal(summary.confirmedPaymentTotal, 400);
  assert.equal(summary.pendingPaymentTotal, 300);
  assert.equal(summary.remainingAmount, 600);
  assert.equal(summary.isPaid, false);
});

test("auto invoice builder uses accepted quote items and final operation itinerary snapshot", () => {
  const result = buildInvoiceFromFinalQuote({
    reservation: {
      id: "reservation-1",
      reservation_code: "RSV-MY-WT-001",
      tour_start_date: "2026-03-24",
      tour_end_date: "2026-03-28"
    },
    quoteCase: {
      id: "case-1",
      case_code: "Q-MY-WT-001",
      tour_name: "WorldTravellers Seoul",
      currency: "MYR"
    },
    quoteVersion: {
      id: "version-1",
      version_no: 2,
      status: "accepted",
      currency: "MYR",
      public_total_amount: 1300,
      public_fare_options: [{ label: "Adult", amount: 1000 }],
      terms_and_conditions: "Final payment before deadline.",
      accepted_at: "2026-06-29T10:00:00Z"
    },
    quoteItems: [
      {
        id: "item-hotel",
        item_category: "room",
        service_section: "hotel",
        snapshot_item_name: "Final hotel twin room block",
        pricing_unit: "per_room",
        quantity: 2,
        pax_count: 20,
        total_sell_amount: 1000,
        partner_visible_notes: "Twin sharing"
      },
      {
        id: "item-meal",
        item_category: "meal",
        service_section: "meal",
        snapshot_item_name: "Confirmed meals",
        pricing_unit: "per_person",
        quantity: 20,
        pax_count: 20,
        total_sell_amount: 300,
        partner_visible_notes: "Halal-friendly option"
      }
    ],
    itineraryDays: [
      {
        id: "day-1",
        day_no: 1,
        service_date: "2026-03-24",
        title: "Arrival",
        meal_summary: { dinner: "Korean set" },
        public_description: "Arrival transfer"
      }
    ],
    finalSnapshot: {
      day_snapshots: [
        {
          day: 1,
          date: "2026-03-24",
          title: "Arrival Seoul",
          hotel: "Confirmed Seoul Hotel",
          roomType: "Twin",
          meals: { dinner: "Confirmed BBQ dinner" },
          attractions: ["Myeongdong"],
          description: "Operator confirmed arrival flow",
          specialNotes: "Late check-in"
        }
      ],
      flight_details: [{ type: "Arrival", flightNo: "MH066" }],
      bank_account_snapshot: { payableTo: "JHT" },
      operator_notes: "Ready to issue"
    },
    versionNo: 3
  });

  assert.equal(result.invoice.version_no, 3);
  assert.equal(result.invoice.currency, "MYR");
  assert.equal(result.invoice.total_amount, 1300);
  // 운영 자동 생성 인보이스는 draft로 시작하고 발행은 재무가 별도로 승인합니다.
  assert.equal(result.invoice.status, "draft");
  assert.equal(result.invoice.issued_at, null);
  assert.equal(result.lineItems.length, 2);
  assert.equal(result.invoice.itinerary_snapshot[0].hotel, "Confirmed Seoul Hotel");
  assert.equal(result.invoice.itinerary_snapshot[0].roomType, "Twin");
  assert.equal(result.invoice.itinerary_snapshot[0].meals.dinner, "Confirmed BBQ dinner");
  assert.equal(result.invoice.invoice_payload.termsAndConditions, "Final payment before deadline.");
});

test("settlement status update approves and prevents invalid closing", () => {
  const approved = buildSettlementStatusUpdate(
    {
      currentStatus: "review",
      nextStatus: "approved",
      actorProfileId: "00000000-0000-4000-8000-000000000003"
    },
    new Date("2026-06-26T00:00:00.000Z")
  );

  assert.equal(approved.status, "approved");
  assert.equal(approved.approved_by, "00000000-0000-4000-8000-000000000003");
  assert.equal(approved.approved_at, "2026-06-26T00:00:00.000Z");
  assert.throws(() =>
    buildSettlementStatusUpdate({
      currentStatus: "draft",
      nextStatus: "closed",
      actorProfileId: "00000000-0000-4000-8000-000000000003"
    })
  );
  assert.throws(() =>
    buildSettlementStatusUpdate({
      currentStatus: "closed",
      nextStatus: "review",
      actorProfileId: "00000000-0000-4000-8000-000000000003"
    })
  );
});

test("finance adjustments are blocked after settlement close", () => {
  assert.equal(assertFinanceAdjustmentAllowed({ settlementStatus: null }), true);
  assert.equal(assertFinanceAdjustmentAllowed({ settlementStatus: "draft" }), true);
  assert.equal(assertFinanceAdjustmentAllowed({ settlementStatus: "approved" }), true);
  assert.throws(() => assertFinanceAdjustmentAllowed({ settlementStatus: "closed" }));
  assert.throws(() => assertFinanceEntryAllowed({ settlementStatus: "closed" }));
});

test("guide expense report summarizes PMB-style actual costs and sync rows", () => {
  const summary = summarizeGuideExpenseReport(
    [
      { section: "meal", vendorName: "울산청해횟집", description: "중식", unitAmount: 23000, quantity: 30 },
      { section: "ticket", vendorName: "블루라인", description: "입장료", totalAmount: 360000 },
      { section: "cash_expense", description: "기사일비", totalAmount: "190,000" },
      { section: "guide_fee", description: "가이드 일비", unitAmount: 200000, quantity: 5 }
    ],
    100000
  );

  assert.equal(summary.sectionTotals.meal, 690000);
  assert.equal(summary.sectionTotals.ticket, 360000);
  assert.equal(summary.sectionTotals.cash_expense, 190000);
  assert.equal(summary.sectionTotals.guide_fee, 1000000);
  assert.equal(summary.totalAmount, 2240000);
  assert.equal(summary.settlementAmount, 2140000);

  const rows = buildFinanceExpenseRowsFromGuideReport(
    { reservationId: "reservation-1", currency: "KRW", actorProfileId: "profile-1" },
    summary.lines.map((line, index) => ({ ...line, id: `line-${index + 1}` }))
  );
  assert.equal(rows.length, 4);
  assert.equal(rows[0].category, "restaurant");
  assert.equal(rows[0].source_guide_expense_report_line_id, "line-1");
});

test("readiness report marks required environment variables without exposing values", () => {
  const report = buildReadinessReport({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    AUTOMATION_SECRET: "automation",
    GMAIL_WEBHOOK_SECRET: "gmail",
    SUPPLIER_MESSAGE_WEBHOOK_SECRET: ""
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.summary.requiredConfigured, 5);
  assert.equal(report.summary.requiredMissing, 1);
  assert.equal(report.envChecks.some((check) => "value" in check), false);
  assert.equal(
    report.envChecks.find((check) => check.envName === "SUPPLIER_MESSAGE_WEBHOOK_SECRET")?.status,
    "missing"
  );
});

test("readiness smoke summary blocks on failed database checks", () => {
  const summary = summarizeReadinessSmokeChecks([
    { key: "agency_accounts", label: "Agencies", table: "agency_accounts", group: "Master Data", status: "ready", error: null },
    { key: "invoices", label: "Invoices", table: "invoices", group: "Finance", status: "failed", error: "relation missing" }
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.ready, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.status, "blocked");
});

test("readiness report covers v1 workflow gates and expanded smoke tables", () => {
  const report = buildReadinessReport({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    AUTOMATION_SECRET: "automation",
    GMAIL_WEBHOOK_SECRET: "gmail",
    SUPPLIER_MESSAGE_WEBHOOK_SECRET: "supplier",
    EXPORT_STORAGE_BUCKET: "exports"
  });
  const workflowSummary = summarizeReadinessWorkflowChecks(report.workflowChecks);

  assert.equal(report.status, "ready");
  assert.equal(report.workflowSummary.total, report.workflowChecks.length);
  assert.equal(workflowSummary.groups["Supplier Messaging"] >= 1, true);
  assert.equal(report.workflowChecks.some((check) => check.key === "quote_item_cost_selector"), true);
  assert.equal(report.workflowChecks.some((check) => check.key === "quote_xlsx_export_worker"), true);
  assert.equal(report.workflowChecks.some((check) => check.key === "quote_xlsx_export_retry"), true);
  assert.equal(report.workflowChecks.some((check) => check.key === "supplier_message_delivery_worker"), true);
  assert.equal(report.workflowChecks.some((check) => check.key === "supplier_message_requeue"), true);
  assert.equal(report.workflowChecks.some((check) => check.key === "api_log_visibility"), true);
  assert.equal(report.launchChecks.some((check) => check.key === "verify_v1"), true);
  assert.equal(report.launchChecks.some((check) => check.key === "configure_domain"), true);
  assert.equal(report.launchChecks.some((check) => check.key === "schedule_workers"), true);
  assert.equal(summarizeReadinessLaunchChecks(report.launchChecks).groups["Supabase"] >= 1, true);
  assert.equal(READINESS_SMOKE_TABLES.some((check) => check.table === "quote_items"), true);
  assert.equal(READINESS_SMOKE_TABLES.some((check) => check.table === "quote_exports"), true);
  assert.equal(READINESS_SMOKE_TABLES.some((check) => check.table === "supplier_prices"), true);
  assert.equal(READINESS_SMOKE_TABLES.some((check) => check.table === "settlements"), true);
  assert.equal(READINESS_SMOKE_TABLES.some((check) => check.table === "email_threads"), true);
  assert.equal(READINESS_SMOKE_TABLES.some((check) => check.table === "email_messages"), true);
  assert.equal(READINESS_SMOKE_TABLES.some((check) => check.table === "gmail_messages"), false);
  const storageSummary = summarizeReadinessStorageChecks([
    {
      key: "quote_exports_bucket",
      label: "Quote export XLSX bucket",
      bucketEnvName: "EXPORT_STORAGE_BUCKET",
      defaultBucket: "exports",
      bucketName: "exports",
      group: "Storage",
      status: "ready",
      error: null
    }
  ]);
  assert.equal(storageSummary.status, "ready");
});

test("initial admin bootstrap builds profile and rejects repeat bootstrap", () => {
  const company = buildInitialCompanyBootstrapRow({ code: "jht", nameKo: "정호여행사", nameEn: "Jungho Travel" });
  const rows = buildInitialAdminBootstrapRows({
    authUserId: "00000000-0000-4000-8000-000000000001",
    email: "ADMIN@JUNGHOTRAVEL.COM",
    displayName: "JHT Admin",
    companyId: "11111111-1111-4111-8111-111111111111"
  });

  assert.equal(company.code, "JHT");
  assert.equal(company.name_ko, "정호여행사");
  assert.equal(rows.profile.email, "admin@junghotravel.com");
  assert.equal(rows.profile.display_name, "JHT Admin");
  assert.equal(rows.profile.default_company_id, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(rows.roles.map((role) => role.role), ["admin", "finance"]);
  assert.equal(assertBootstrapAllowed({ adminRoleCount: 0 }), true);
  assert.throws(() => assertBootstrapAllowed({ adminRoleCount: 1 }));
});

test("internal user role management normalizes and validates roles", () => {
  const profile = buildInternalProfileRow({
    authUserId: "00000000-0000-4000-8000-000000000002",
    email: "SALES@JUNGHOTRAVEL.COM",
    displayName: ""
  });
  const roles = normalizeRoles(["sales", "sales", "operations"]);
  const rows = buildInternalUserRoleRows({ userId: profile.id, roles });

  assert.equal(profile.email, "sales@junghotravel.com");
  assert.equal(profile.display_name, "sales@junghotravel.com");
  assert.deepEqual(roles, ["sales", "operations"]);
  assert.deepEqual(rows.map((row) => row.role), ["sales", "operations"]);
  assert.throws(() => normalizeRoles(["agency_user"]));
});

test("company creation normalizes code and requires bilingual names", () => {
  const row = buildCompanyCreateRow({
    code: "jht-main",
    nameKo: "Jungho Travel Korea",
    nameEn: "Jungho Travel"
  });

  assert.equal(row.code, "JHT-MAIN");
  assert.equal(row.name_ko, "Jungho Travel Korea");
  assert.equal(row.name_en, "Jungho Travel");
  assert.equal(row.status, "active");
  assert.throws(() => buildCompanyCreateRow({ code: "x", nameKo: "A", nameEn: "B" }));
  assert.throws(() => buildCompanyCreateRow({ code: "JHT", nameKo: "", nameEn: "B" }));
});

test("notion csv migration validation catches target required fields", () => {
  const result = validateMigrationRows({
    targetTable: "domestic_suppliers",
    rows: [
      {
        id: "row-1",
        rowNo: 1,
        rawPayload: {
          company_id: "00000000-0000-4000-8000-000000001001",
          name_ko: "정호호텔",
          category: "hotel"
        }
      },
      {
        id: "row-2",
        rowNo: 2,
        rawPayload: {
          company_id: "00000000-0000-4000-8000-000000001001",
          category: "restaurant"
        }
      }
    ]
  });

  assert.equal(result.status, "failed");
  assert.equal(result.rowCount, 2);
  assert.equal(result.validRowCount, 1);
  assert.equal(result.errorCount, 1);
  assert.equal(result.rows[0].validationStatus, "valid");
  assert.equal(result.rows[1].validationStatus, "invalid");
  assert.match(result.errors[0].errorMessage, /name_ko/);
});

test("notion csv migration status gates approval after validation", () => {
  const validated = buildMigrationStatusUpdate({
    currentStatus: "uploaded",
    nextStatus: "validated",
    actorProfileId: "00000000-0000-4000-8000-000000000004"
  });

  assert.equal(validated.status, "validated");
  assert.equal(validated.audit.action, "notion_csv.validated");

  const approved = buildMigrationStatusUpdate(
    {
      currentStatus: "validated",
      nextStatus: "approved",
      actorProfileId: "00000000-0000-4000-8000-000000000004"
    },
    new Date("2026-06-26T00:00:00.000Z")
  );

  assert.equal(approved.status, "approved");
  assert.equal(approved.audit.riskLevel, "high");
  assert.deepEqual(approved.audit.approvalData, {
    approvedBy: "00000000-0000-4000-8000-000000000004",
    approvedAt: "2026-06-26T00:00:00.000Z"
  });
  assert.throws(() =>
    buildMigrationStatusUpdate({
      currentStatus: "uploaded",
      nextStatus: "approved",
      actorProfileId: "00000000-0000-4000-8000-000000000004"
    })
  );
});

test("notion csv migration imports only approved valid mapped rows", () => {
  const imported = buildMigrationStatusUpdate(
    {
      currentStatus: "approved",
      nextStatus: "imported",
      actorProfileId: "00000000-0000-4000-8000-000000000004"
    },
    new Date("2026-06-26T00:00:00.000Z")
  );

  assert.equal(imported.status, "imported");
  assert.equal(imported.audit.action, "notion_csv.imported");
  assert.equal(imported.audit.riskLevel, "high");

  const rows = buildMigrationImportRows({
    targetTable: "domestic_suppliers",
    rows: [
      {
        id: "row-1",
        rowNo: 1,
        validationStatus: "valid",
        mappedPayload: {
          company_id: "00000000-0000-4000-8000-000000001001",
          name_ko: "Seoul Hotel",
          category: "hotel"
        }
      }
    ]
  });

  assert.deepEqual(rows, [
    {
      company_id: "00000000-0000-4000-8000-000000001001",
      name_ko: "Seoul Hotel",
      category: "hotel"
    }
  ]);
  assert.throws(() =>
    buildMigrationImportRows({
      targetTable: "domestic_suppliers",
      rows: [{ id: "row-2", rowNo: 2, validationStatus: "invalid", mappedPayload: { category: "hotel" } }]
    })
  );
  assert.throws(() =>
    buildMigrationImportRows({
      targetTable: "domestic_suppliers",
      rows: [{ id: "row-3", rowNo: 3, validationStatus: "valid", mappedPayload: { category: "hotel" } }]
    })
  );
});

test("notion markdown export maps attraction content into supplier import records", () => {
  const document = parseNotionMarkdownDocument({
    sourcePath: "인사동 한옥마을 1b085c66428880ad9c00eb49112a8279.md",
    baseDir: "C:/notion-export",
    content: `# 인사동 한옥마을

지역_광역: 서울
컨텐츠 유형: 한식조리체험
* 상호명 (EN): Insa-dong
* 검색 대표 키워드: 인사동 (Insa-dong)
* 사용 여부: 확인 필요
* 파트너사 구분: Tour Site
상품 목록: 인사동 (Insa-dong) >>> 투어 (Insadong Street) (https://app.notion.com/p/demo)
상품 목록 (텍스트): [Ticket] 투어
페이지 ID: 1b085c66428880ad9c00eb49112a8279

주소: 서울 종로구 인사동
관람료: 무료
주차: 주차 안됩니다
화장실: 남녀 분리 되어 있습니다

인사동 안에는 김치체험 있습니다

![20250306_154137.jpg](20250306_154137.jpg)
[인사동.mp4](%EC%9D%B8%EC%82%AC%EB%8F%99.mp4)`
  });
  const record = buildSupplierCostMasterFromNotionDocument(document, {
    companyId: "00000000-0000-4000-8000-000000001001"
  });
  const plan = buildNotionMarkdownImportPlan([record], { sourceName: "sample-notion-export" });

  assert.equal(record.supplierRow.category, "attraction");
  assert.equal(record.supplierRow.name_ko, "인사동 한옥마을");
  assert.equal(record.supplierRow.name_en, "Insa-dong");
  assert.equal(record.supplierRow.status, "inactive");
  assert.equal(record.productRows[0].row.product_type, "ticket");
  assert.equal(record.productRows[0].priceRows[0].row.cost_amount, 0);
  assert.equal(record.mediaRows.length, 2);
  assert.equal(plan.summary.supplierCount, 1);
  assert.equal(plan.summary.productCount, 1);
  assert.equal(plan.stagingPayloads.domesticSuppliers.rows[0].company_id, "00000000-0000-4000-8000-000000001001");
});

test("quote export request validates exportable version state and snapshot summary", () => {
  const request = buildQuoteExportRequest({
    quoteVersionId: "quote-version-1",
    versionStatus: "sent",
    publicTotalAmount: 1500000,
    storagePath: "quote-exports/quote-version-1/export.xlsx"
  });

  assert.equal(request.status, "queued");
  assert.equal(request.export_type, "xlsx");
  assert.equal(request.quote_version_id, "quote-version-1");
  assert.throws(() =>
    buildQuoteExportRequest({
      quoteVersionId: "quote-version-1",
      versionStatus: "cancelled",
      publicTotalAmount: 1500000,
      storagePath: "quote-exports/quote-version-1/export.xlsx"
    })
  );
  assert.throws(() =>
    buildQuoteExportRequest({
      quoteVersionId: "quote-version-1",
      versionStatus: "draft",
      publicTotalAmount: 0,
      storagePath: "quote-exports/quote-version-1/export.xlsx"
    })
  );

  const summary = buildQuoteExportSnapshotSummary({
    quoteCase: { caseCode: "JHT-2026-001", tourName: "Seoul Incentive" },
    version: {
      versionNo: 2,
      status: "sent",
      currency: "KRW",
      publicTotalAmount: 1500000,
      itineraryDays: [{ routeSegments: [{}, {}] }],
      items: [{}, {}, {}]
    }
  });

  assert.deepEqual(summary, {
    caseCode: "JHT-2026-001",
    tourName: "Seoul Incentive",
    versionNo: 2,
    status: "sent",
    currency: "KRW",
    publicTotalAmount: 1500000,
    itineraryDayCount: 1,
    routeSegmentCount: 2,
    itemCount: 3
  });
});

test("failed quote exports can be retried with the same storage path", () => {
  const update = buildQuoteExportRetryUpdate({
    id: "export-1",
    status: "failed",
    storage_path: "quote-exports/version-1/export.xlsx",
    error_message: "Storage timeout"
  });

  assert.deepEqual(update, { status: "queued", error_message: null });
  assert.throws(() =>
    buildQuoteExportRetryUpdate({
      id: "export-1",
      status: "completed",
      storage_path: "quote-exports/version-1/export.xlsx"
    })
  );
  assert.throws(() =>
    buildQuoteExportRetryUpdate({
      id: "export-1",
      status: "failed",
      storage_path: "quote-exports/version-1/export.pdf"
    })
  );
});

test("failed automation jobs combine supplier delivery and quote export recovery queues", async () => {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(table);
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          if (table === "supplier_message_outbox") {
            return Promise.resolve({
              data: [
                {
                  id: "message-1",
                  domestic_supplier_id: "supplier-1",
                  message_type: "booking_request",
                  channel: "email",
                  risk_level: "normal",
                  status: "failed",
                  subject: "Booking request",
                  approved_at: "2026-06-26T00:00:00.000Z",
                  second_approved_at: null,
                  error_message: "Provider timeout",
                  updated_at: "2026-06-26T03:00:00.000Z",
                  created_at: "2026-06-26T01:00:00.000Z",
                  reservations: { reservation_code: "RSV-1" },
                  domestic_suppliers: { name_ko: "Seoul Hotel" }
                }
              ],
              error: null
            });
          }
          return Promise.resolve({
            data: [
              {
                id: "export-1",
                quote_version_id: "version-1",
                export_type: "xlsx",
                storage_path: "quote-exports/version-1/export.xlsx",
                status: "failed",
                error_message: "Storage timeout",
                created_at: "2026-06-26T02:00:00.000Z",
                quote_versions: {
                  id: "version-1",
                  version_no: 2,
                  quote_case_id: "case-1",
                  quote_cases: { id: "case-1", case_code: "JHT-1", tour_name: "Seoul Incentive" }
                }
              }
            ],
            error: null
          });
        }
      };
      return builder;
    }
  };

  const jobs = await listFailedAutomationJobs(supabase);

  assert.deepEqual(calls, ["supplier_message_outbox", "quote_exports"]);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].kind, "supplier_message");
  assert.equal(jobs[0].detailHref, "/admin/supplier-messages/message-1");
  assert.equal(jobs[1].kind, "quote_export");
  assert.equal(jobs[1].detailHref, "/admin/quote-cases/case-1");
});

test("xlsx writer produces an Office Open XML workbook package", () => {
  const workbook = createXlsxBuffer([
    ["Case Code", "JHT-2026-001"],
    ["Public Total", 1500000]
  ]);

  assert.equal(workbook.readUInt32LE(0), 0x04034b50);
  assert.match(workbook.toString("utf8"), /\[Content_Types\]\.xml/);
  assert.match(workbook.toString("utf8"), /xl\/worksheets\/sheet1\.xml/);
  assert.match(workbook.toString("utf8"), /JHT-2026-001/);

  const quoteWorkbook = buildQuoteExportWorkbook({
    summary: {
      caseCode: "JHT-2026-001",
      tourName: "Seoul Incentive",
      versionNo: 1,
      status: "sent",
      currency: "KRW",
      publicTotalAmount: 1500000
    },
    itineraryDays: [{ dayNo: 1, serviceDate: "2026-07-01", title: "Arrival", routeSegments: [] }],
    items: [
      {
        itemCategory: "hotel",
        snapshotItemName: "Hotel Twin",
        snapshotSupplierName: "Seoul Hotel",
        snapshotUnitCostAmount: 100000,
        quantity: 10,
        paxCount: 20,
        totalCostKrw: 1000000,
        totalSellAmount: 1200000
      }
    ]
  });

  assert.match(quoteWorkbook.toString("utf8"), /Internal Snapshot Items/);
  assert.match(quoteWorkbook.toString("utf8"), /Hotel Twin/);
});

test("api log sanitizer redacts secrets and truncates large payload values", () => {
  const sanitized = sanitizeApiLogPayload({
    authorization: "Bearer secret",
    gmailMessageId: "gmail-1",
    bodyText: "sensitive email body",
    nested: {
      passportNo: "M1234567",
      safeCount: 3,
      longText: "x".repeat(700)
    }
  });

  assert.equal(sanitized.authorization, "[redacted]");
  assert.equal(sanitized.bodyText, "[redacted]");
  assert.equal(sanitized.nested.passportNo, "[redacted]");
  assert.equal(sanitized.nested.safeCount, 3);
  assert.equal(sanitized.nested.longText.length, 503);
  assert.equal(sanitized.gmailMessageId, "gmail-1");
});


test("reservation status transitions enforce an allowed map and require a reason for high-risk moves", () => {
  const plan = planReservationStatusChange({ currentStatus: "requested", nextStatus: "confirmed", reason: "Supplier confirmed" });
  assert.equal(plan.nextStatus, "confirmed");
  assert.equal(plan.isHighRisk, true);
  assert.equal(plan.riskLevel, "high");
  assert.equal(plan.reason, "Supplier confirmed");

  const cancel = planReservationStatusChange({ currentStatus: "confirmed", nextStatus: "cancelled", reason: "Client withdrew" });
  assert.equal(cancel.riskLevel, "high");

  const advance = planReservationStatusChange({ currentStatus: "confirmed", nextStatus: "on_tour" });
  assert.equal(advance.riskLevel, "normal");

  assert.throws(() => planReservationStatusChange({ currentStatus: "cancelled", nextStatus: "confirmed", reason: "x" }), /cannot move from cancelled to confirmed/);
  assert.throws(() => planReservationStatusChange({ currentStatus: "completed", nextStatus: "requested", reason: "x" }), /cannot move from completed to requested/);
  assert.throws(() => planReservationStatusChange({ currentStatus: "requested", nextStatus: "confirmed" }), /reason is required/);
  assert.throws(() => planReservationStatusChange({ currentStatus: "pending", nextStatus: "pending" }), /already pending/);
  assert.deepEqual([...RESERVATION_STATUS_LIST].sort(), ["cancelled", "completed", "confirmed", "on_tour", "pending", "requested"]);
});

test("settlement recalculation counts only the latest invoice version per tour", () => {
  const invoices = [
    { id: "inv-1", tour_code: "JHT-2026-001", version_no: 1, total_amount: 10000000, currency: "KRW", status: "issued" },
    { id: "inv-2", tour_code: "JHT-2026-001", version_no: 2, total_amount: 10500000, currency: "KRW", status: "issued" },
    { id: "inv-3", tour_code: null, version_no: 1, total_amount: 500000, currency: "KRW", status: "issued" }
  ];
  const active = selectActiveInvoices(invoices);
  assert.equal(active.length, 2);
  assert.ok(active.some((row) => row.id === "inv-2"));
  assert.ok(!active.some((row) => row.id === "inv-1"));

  const totals = computeSettlementTotals({
    invoices,
    payments: [{ amount: 4000000, status: "confirmed" }],
    expenses: [{ amount: 3000000, currency: "KRW" }],
    extraRevenues: [{ amount: 200000, currency: "KRW" }],
    commissions: [{ commission_amount: 100000, currency: "KRW" }]
  });
  // 10.5M (latest) + 0.5M standalone = 11M invoice, not 21.5M.
  assert.equal(totals.total_invoice_amount, 11000000);
  assert.equal(totals.total_payment_amount, 4000000);
  assert.equal(totals.final_profit_amount, 11000000 + 200000 + 100000 - 3000000);
});

test("settlement recalculation rejects mixed currencies", () => {
  assert.throws(
    () =>
      computeSettlementTotals({
        invoices: [{ tour_code: null, total_amount: 1300, currency: "MYR", status: "issued" }],
        expenses: [{ amount: 500000, currency: "KRW" }]
      }),
    /mix currencies/
  );
  assert.equal(roundMoney(10.005), 10.01);
});

test("payment input requires a matching currency and explicit idempotency key", () => {
  const ok = validatePaymentInput({
    invoiceCurrency: "MYR",
    amount: 1300,
    status: "confirmed",
    currency: "MYR",
    idempotencyKey: "wire-88",
    referenceNo: "TT-88"
  });
  assert.equal(ok.amount, 1300);
  assert.equal(ok.currency, "MYR");

  assert.throws(() => validatePaymentInput({ invoiceCurrency: "MYR", amount: 1300, currency: "KRW", idempotencyKey: "k", referenceNo: "r" }), /does not match invoice currency/);
  assert.throws(() => validatePaymentInput({ invoiceCurrency: "KRW", amount: 0, idempotencyKey: "k" }), /positive number/);
  assert.throws(() => validatePaymentInput({ invoiceCurrency: "KRW", amount: 100 }), /idempotencyKey is required/);
  assert.throws(() => validatePaymentInput({ invoiceCurrency: "KRW", amount: 100, status: "confirmed", idempotencyKey: "k" }), /referenceNo is required/);
});

test("invoice payment state flips to paid and flags overpayment", () => {
  const partial = resolveInvoicePaymentState({ invoiceTotal: 1000, currentStatus: "issued", payments: [{ status: "confirmed", amount: 400 }] });
  assert.equal(partial.nextStatus, "partially_paid");
  assert.equal(partial.isOverpaid, false);

  const paid = resolveInvoicePaymentState({ invoiceTotal: 1000, currentStatus: "issued", payments: [{ status: "confirmed", amount: 1000 }] });
  assert.equal(paid.nextStatus, "paid");

  const over = resolveInvoicePaymentState({ invoiceTotal: 1000, currentStatus: "issued", payments: [{ status: "confirmed", amount: 1200 }] });
  assert.equal(over.nextStatus, "paid");
  assert.equal(over.isOverpaid, true);
});


test("currency conversion divides KRW by the quote-currency rate and is a no-op for KRW", () => {
  // rate = 견적 통화 1단위당 KRW. 1 MYR = 300 KRW 이면 30000 KRW = 100 MYR.
  assert.equal(convertKrwToQuoteCurrency(30000, 300, "MYR"), 100);
  assert.equal(convertKrwToQuoteCurrency(1300, 1, "MYR"), 1300);
  assert.equal(convertKrwToQuoteCurrency(5740000, 1, "KRW"), 5740000);
  // KRW 대상은 rate와 무관하게 그대로 유지합니다.
  assert.equal(convertKrwToQuoteCurrency(5740000, 999, "KRW"), 5740000);
  assert.throws(() => convertKrwToQuoteCurrency(1000, 0, "MYR"), /positive number/);
});

test("auto invoice converts KRW quote amounts into the quote currency at issuance", () => {
  const result = buildInvoiceFromFinalQuote({
    reservation: { id: "r1", reservation_code: "RSV-1", tour_start_date: "2026-03-24" },
    quoteCase: { id: "c1", case_code: "Q-1", tour_name: "T", currency: "MYR" },
    quoteVersion: {
      id: "v1",
      version_no: 1,
      status: "accepted",
      currency: "MYR",
      exchange_rate_to_krw: 300,
      public_total_amount: 390000,
      accepted_at: "2026-06-29T10:00:00Z"
    },
    quoteItems: [
      { id: "i1", item_category: "room", snapshot_item_name: "Hotel", pricing_unit: "per_room", quantity: 2, total_sell_amount: 300000 },
      { id: "i2", item_category: "meal", snapshot_item_name: "Meals", pricing_unit: "per_person", quantity: 20, total_sell_amount: 90000 }
    ],
    itineraryDays: [],
    finalSnapshot: null,
    versionNo: 1
  });
  // 300000 KRW / 300 = 1000 MYR, 90000 / 300 = 300 MYR => total 1300 MYR
  assert.equal(result.invoice.currency, "MYR");
  assert.equal(result.invoice.total_amount, 1300);
  assert.equal(result.lineItems[0].total_amount, 1000);
  assert.equal(result.lineItems[1].total_amount, 300);
});

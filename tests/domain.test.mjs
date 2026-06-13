import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuoteItem, buildQuoteSnapshot } from "../src/lib/domain/quotation.mjs";
import { buildReminderCandidates, createDefaultOperationTasks } from "../src/lib/domain/operations.mjs";
import {
  assertSupplierMessageCanSend,
  buildSupplierMessageDraft
} from "../src/lib/domain/supplier-messages.mjs";
import { scoreGmailMatch } from "../src/lib/domain/gmail-match.mjs";

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

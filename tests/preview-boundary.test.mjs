import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guardedPages = [
  "src/app/admin/reservations/page.tsx",
  "src/app/admin/reservations/incomplete/page.tsx",
  "src/app/admin/reservations/[reservationId]/page.tsx",
  "src/app/admin/reservations/[reservationId]/operation-checklist/page.tsx",
  "src/app/admin/confirmations/page.tsx",
  "src/app/admin/confirmations/[reservationId]/page.tsx",
  "src/app/admin/finance/invoices/page.tsx",
  "src/app/admin/finance/invoices/[invoiceId]/page.tsx",
  "src/app/admin/guide-expenses/page.tsx",
  "src/app/admin/guide-expenses/[reservationId]/page.tsx",
  "src/app/admin/workflows/[workflowCode]/page.tsx",
  "src/app/agency/inquiries/page.tsx",
  "src/app/agency/quote-cases/page.tsx",
  "src/app/agency/reservations/page.tsx",
  "src/app/agency/invoices/page.tsx",
  "src/app/agency/invoices/[invoiceId]/page.tsx",
  "src/app/agency/workflows/[workflowCode]/page.tsx"
];

test("demo-backed pages require the shared non-production demo gate", () => {
  for (const file of guardedPages) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /isDemoModeEnabled/, `${file} must guard demo records with isDemoModeEnabled`);
  }
});

test("the shared demo gate is disabled in production", () => {
  const source = readFileSync("src/lib/api/guards.ts", "utf8");
  assert.match(source, /process\.env\.NODE_ENV\s*!==\s*["']production["']/);
  assert.match(source, /JHT_DEMO_MODE/);
});

test("workflow detail API does not leak seeded demo threads in production", () => {
  const source = readFileSync("src/app/api/workflows/[workflowCode]/route.ts", "utf8");
  assert.match(source, /isDemoModeEnabled\(\)\s*&&\s*demo/);
  assert.doesNotMatch(source, /if\s*\(!seed\)\s*return\s+ok\(demo\s*\?/);
});

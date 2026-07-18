import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const readinessMigration = read("supabase/migrations/202607150002_reservation_readiness_dashboard.sql");
const requestSecurityMigration = read("supabase/migrations/202607180001_partner_request_payment_security.sql");
const financeKpiMigration = read("supabase/migrations/202607180002_admin_finance_kpis.sql");
const supplierSafetyMigration = read("supabase/migrations/202607180003_supplier_message_delivery_safety.sql");
const bookingRoute = read("src/app/api/agency/quote-cases/[id]/booking-request/route.ts");
const revisionRoute = read("src/app/api/agency/quote-cases/[id]/revision-request/route.ts");
const paymentRoute = read("src/app/api/finance/invoices/[id]/payments/route.ts");
const dashboardPage = read("src/app/admin/page.tsx");
const financeQueries = read("src/features/finance/queries.ts");
const supplierWorker = read("src/app/api/automation/supplier-messages/run/route.ts");
const supplierRequeueRoute = read("src/app/api/supplier-messages/[id]/requeue/route.ts");

test("reservation readiness SECURITY DEFINER functions are not callable by public API roles", () => {
  for (const source of [readinessMigration, requestSecurityMigration]) {
    assert.match(
      source,
      /revoke all on function (?:public\.)?refresh_reservation_operation_readiness\(uuid\) from public, anon, authenticated/i
    );
    assert.match(source, /grant execute on function (?:public\.)?refresh_reservation_operation_readiness\(uuid\) to service_role/i);
  }
});

test("partner booking and revision requests use one authenticated atomic RPC", () => {
  assert.match(requestSecurityMigration, /create or replace function submit_agency_quote_request_atomic/i);
  assert.match(requestSecurityMigration, /security definer\s+set search_path = ''/i);
  assert.match(requestSecurityMigration, /auth\.uid\(\)/i);
  assert.match(requestSecurityMigration, /insert into public\.agency_inquiries/i);
  assert.match(requestSecurityMigration, /update public\.quote_cases/i);
  assert.match(requestSecurityMigration, /insert into public\.audit_logs/i);
  assert.match(requestSecurityMigration, /from public, anon;/i);

  for (const route of [bookingRoute, revisionRoute]) {
    assert.match(route, /\.rpc\("submit_agency_quote_request_atomic"/);
    assert.doesNotMatch(route, /\.from\("agency_inquiries"\)/);
    assert.doesNotMatch(route, /writeAuditLog/);
  }
});

test("payment replay is scoped to its invoice in SQL and both API lookup paths", () => {
  assert.match(
    requestSecurityMigration,
    /create unique index payments_invoice_idempotency_uidx\s+on public\.payments\(invoice_id, idempotency_key\)/i
  );
  assert.doesNotMatch(requestSecurityMigration, /create unique index payments_idempotency_key_uidx/i);

  const replayLookups = paymentRoute.match(/\.eq\("invoice_id", id\)\s*\.eq\("idempotency_key", input\.idempotencyKey\)/g) ?? [];
  assert.equal(replayLookups.length, 2);
});

test("client forms use safeFetch so network rejection resolves to an unlockable response", () => {
  const componentRoots = [
    new URL("../src/components/admin", import.meta.url),
    new URL("../src/components/agency", import.meta.url),
    new URL("../src/components/auth", import.meta.url),
    new URL("../src/components/workflow", import.meta.url)
  ];
  const files = componentRoots.flatMap((root) => collectTsxFiles(fileURLToPath(root)));
  const nativeFetchFiles = files.filter((file) => /\bfetch\s*\(/.test(readFileSync(file, "utf8")));
  assert.deepEqual(nativeFetchFiles, []);

  const safeFetch = read("src/lib/client/safe-fetch.ts");
  assert.match(safeFetch, /try\s*{/);
  assert.match(safeFetch, /catch/);
  assert.match(safeFetch, /status:\s*503/);
});

test("safeFetch converts an actual rejected network promise into a JSON error response", async () => {
  const source = read("src/lib/client/safe-fetch.ts");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const { safeFetch } = await import(moduleUrl);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("simulated network disconnect");
  };

  try {
    const response = await safeFetch("https://example.invalid/save", { method: "POST" });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Network connection failed. Please check your connection and retry."
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin finance KPIs are aggregated by a full-dataset RPC, not a paged list", () => {
  assert.match(financeKpiMigration, /create or replace function get_admin_finance_kpis/i);
  assert.match(financeKpiMigration, /from public\.invoices|from invoices/i);
  assert.doesNotMatch(financeKpiMigration, /limit\s+100/i);
  assert.match(financeQueries, /\.rpc\("get_admin_finance_kpis"/);
  assert.match(dashboardPage, /getAdminFinanceKpis/);
  assert.match(dashboardPage, /financeKpis\.receivableAmount/);
});

test("supplier delivery logging cannot reverse a finalized message or permit unsafe requeue", () => {
  assert.match(supplierWorker, /Promise\.allSettled/);
  assert.match(supplierWorker, /\.eq\("status", "sending"\)/);
  assert.match(supplierWorker, /reason: "message was already finalized"/);
  assert.doesNotMatch(supplierWorker, /SUPPLIER_MESSAGE_ALLOW_UNIMPLEMENTED_LIVE/);
  assert.match(supplierRequeueRoute, /\.is\("provider_message_id", null\)/);
  assert.match(supplierRequeueRoute, /\.is\("sent_at", null\)/);
  assert.match(supplierSafetyMigration, /provider_message_id is not null or old\.sent_at is not null/i);
});

function collectTsxFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return collectTsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

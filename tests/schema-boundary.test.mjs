import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const initialSchema = readFileSync(new URL("../supabase/migrations/202605100001_initial_schema.sql", import.meta.url), "utf8");
const gmailCandidatesMigration = readFileSync(
  new URL("../supabase/migrations/202606260001_gmail_match_candidates.sql", import.meta.url),
  "utf8"
);
const quoteExcelModelMigration = readFileSync(
  new URL("../supabase/migrations/202606270001_quote_excel_model.sql", import.meta.url),
  "utf8"
);
const quoteFareOptionsMigration = readFileSync(
  new URL("../supabase/migrations/202606270002_quote_fare_options.sql", import.meta.url),
  "utf8"
);
const quotePresentationBlocksMigration = readFileSync(
  new URL("../supabase/migrations/202606270003_quote_presentation_blocks.sql", import.meta.url),
  "utf8"
);
const supplierMediaAttachmentsMigration = readFileSync(
  new URL("../supabase/migrations/202606270004_supplier_media_attachments.sql", import.meta.url),
  "utf8"
);
const partnerReceivableLedgerMigration = readFileSync(
  new URL("../supabase/migrations/202606280001_partner_receivable_ledger.sql", import.meta.url),
  "utf8"
);
const exchangeRatesMigration = readFileSync(
  new URL("../supabase/migrations/202606280002_exchange_rates.sql", import.meta.url),
  "utf8"
);
const agencyInquiryTourWorkflowMigration = readFileSync(
  new URL("../supabase/migrations/202606290001_agency_inquiry_tour_workflow.sql", import.meta.url),
  "utf8"
);
const invoiceVersioningMigration = readFileSync(
  new URL("../supabase/migrations/202606290002_invoice_versioning.sql", import.meta.url),
  "utf8"
);
const finalOperationInvoiceMigration = readFileSync(
  new URL("../supabase/migrations/202606290003_reservation_final_operation_invoice.sql", import.meta.url),
  "utf8"
);
const guideExpenseReportsMigration = readFileSync(
  new URL("../supabase/migrations/202606290004_guide_expense_reports.sql", import.meta.url),
  "utf8"
);
const agencyOnboardingGovernanceMigration = readFileSync(
  new URL("../supabase/migrations/202606300001_agency_onboarding_governance.sql", import.meta.url),
  "utf8"
);
const countryReferenceExchangeRatesMigration = readFileSync(
  new URL("../supabase/migrations/202606300002_country_reference_exchange_rates.sql", import.meta.url),
  "utf8"
);
const workflowPortalCommunicationMigration = readFileSync(
  new URL("../supabase/migrations/202606300003_workflow_portal_communication.sql", import.meta.url),
  "utf8"
);
const schema = `${initialSchema}\n${gmailCandidatesMigration}\n${quoteExcelModelMigration}\n${quoteFareOptionsMigration}\n${quotePresentationBlocksMigration}\n${supplierMediaAttachmentsMigration}\n${partnerReceivableLedgerMigration}\n${exchangeRatesMigration}\n${agencyInquiryTourWorkflowMigration}\n${invoiceVersioningMigration}\n${finalOperationInvoiceMigration}\n${guideExpenseReportsMigration}\n${agencyOnboardingGovernanceMigration}\n${countryReferenceExchangeRatesMigration}\n${workflowPortalCommunicationMigration}`;
const agencyPortalQueries = readFileSync(new URL("../src/features/agency-portal/queries.ts", import.meta.url), "utf8");
const apiHttp = readFileSync(new URL("../src/lib/api/http.ts", import.meta.url), "utf8");
const seedSql = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const launchRunbook = readFileSync(new URL("../docs/launch-runbook.md", import.meta.url), "utf8");

test("agency and domestic supplier tables are separate business boundaries", () => {
  assert.match(schema, /create table agency_accounts/);
  assert.match(schema, /create table agency_users/);
  assert.match(schema, /create table domestic_suppliers/);
  assert.match(schema, /create table supplier_products/);
  assert.doesNotMatch(schema, /create table partners\b/);
});

test("agency booking requests are represented without granting reservation write access", () => {
  assert.match(schema, /agency_inquiry_type as enum \('[^']*new_inquiry[^;]+booking_request/);
  assert.match(schema, /create policy "reservations internal all"/);
  assert.match(schema, /create policy "reservations agency select"/);
  assert.doesNotMatch(schema, /create policy "reservations agency insert"/);
});

test("agency inquiries carry tour workflow fields for partner portal revisions", () => {
  assert.match(schema, /add column if not exists tour_code text/);
  assert.match(schema, /add column if not exists arrival_date date/);
  assert.match(schema, /add column if not exists departure_date date/);
  assert.match(schema, /add column if not exists period_text text/);
  assert.match(schema, /add column if not exists nights_count integer/);
  assert.match(schema, /add column if not exists flight_details jsonb/);
  assert.match(schema, /agency_inquiries_tour_code_idx/);
});

test("overseas agency cannot read supplier costs or quote item internals", () => {
  assert.match(schema, /create policy "supplier prices internal only"/);
  assert.match(schema, /create policy "quote items internal only"/);
  assert.doesNotMatch(schema, /supplier prices agency select/);
  assert.doesNotMatch(schema, /quote items agency select/);
});

test("supplier message send is protected by approvals and idempotency", () => {
  assert.match(schema, /idempotency_key text not null unique/);
  assert.match(schema, /status not in \('approved', 'queued', 'sending', 'sent'\) or \(approved_by is not null/);
  assert.match(schema, /message_type <> 'cancellation_request' or status not in \('queued', 'sending', 'sent'\) or second_approved_by is not null/);
});

test("route segments can be shared to agencies only through sent quote versions", () => {
  assert.match(schema, /create policy "route segments agency select"/);
  assert.match(schema, /qv.status in \('sent', 'accepted', 'superseded'\)/);
});

test("gmail matching stores candidate evidence for manual review", () => {
  assert.match(schema, /create table if not exists gmail_match_candidates/);
  assert.match(schema, /email_thread_id uuid not null references email_threads/);
  assert.match(schema, /quote_case_id uuid not null references quote_cases/);
  assert.match(schema, /reasons jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /create policy "gmail match candidates internal all"/);
});

test("api logs are internal operational traces", () => {
  assert.match(schema, /create table api_logs/);
  assert.match(schema, /create policy "api logs internal read insert"/);
  assert.match(schema, /create policy "api logs internal insert"/);
  assert.doesNotMatch(schema, /api logs agency/);
});

test("partner receivable ledger is finance-only", () => {
  assert.match(schema, /create table if not exists partner_receivable_ledger/);
  assert.match(schema, /agency_account_id uuid references agency_accounts/);
  assert.match(schema, /monthly_tour_amounts jsonb not null default '\{\}'::jsonb/);
  assert.match(schema, /create policy "partner receivable ledger finance only"/);
  assert.doesNotMatch(schema, /partner receivable ledger agency/);
});

test("exchange rates are centrally managed by internal users", () => {
  assert.match(schema, /create table if not exists exchange_rates/);
  assert.match(schema, /country_code text/);
  assert.match(schema, /country_name text/);
  assert.match(schema, /base_currency text not null/);
  assert.match(schema, /quote_currency text not null default 'KRW'/);
  assert.match(schema, /exchange_rates_lookup_idx/);
  assert.match(schema, /create table if not exists quote_exchange_rate_snapshots/);
  assert.match(schema, /quote_version_id uuid not null references quote_versions\(id\) on delete cascade/);
  assert.match(schema, /source_exchange_rate_id uuid references exchange_rates\(id\)/);
  assert.match(schema, /create policy "exchange rates internal all"/);
  assert.match(schema, /create policy "quote exchange snapshots internal all"/);
  assert.doesNotMatch(schema, /exchange rates agency/);
});

test("quote items preserve excel-style costing metadata for revision versions", () => {
  for (const column of [
    "service_section",
    "calculation_mode",
    "excel_cell_ref",
    "excel_formula",
    "manual_override",
    "supplier_cost_breakdown",
    "public_breakdown"
  ]) {
    assert.match(schema, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(schema, /quote_items_version_section_idx/);
});

test("quote versions preserve public fare options from excel-style quotation sheets", () => {
  assert.match(schema, /add column if not exists public_fare_options jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /add column if not exists excel_source_summary jsonb not null default '\{\}'::jsonb/);
});

test("quote presentation blocks expose only public media to agencies", () => {
  assert.match(schema, /create table if not exists quote_presentation_blocks/);
  assert.match(schema, /source_supplier_media_id uuid references supplier_media/);
  assert.match(schema, /is_public boolean not null default true/);
  assert.match(schema, /create policy "quote presentation blocks internal all"/);
  assert.match(schema, /create policy "quote presentation blocks agency select"/);
  assert.match(schema, /is_public = true/);
  assert.match(schema, /qv.status in \('sent', 'accepted', 'superseded'\)/);
});

test("supplier media supports item images with a hard maximum", () => {
  assert.match(schema, /add column if not exists image_url text/);
  assert.match(schema, /add column if not exists alt_text text/);
  assert.match(schema, /supplier_media_has_image_source/);
  assert.match(schema, /create or replace function enforce_supplier_media_image_limit/);
  assert.match(schema, /supplier product image limit exceeded: max 10 images per item/);
  assert.match(schema, /create trigger supplier_media_image_limit/);
});

test("invoice versioning stores line items and collection state safely", () => {
  assert.match(schema, /add column if not exists tour_code text/);
  assert.match(schema, /add column if not exists version_no integer not null default 1/);
  assert.match(schema, /add column if not exists collection_status text not null default 'unpaid'/);
  assert.match(schema, /add column if not exists bank_account_snapshot jsonb not null default '\{\}'::jsonb/);
  assert.match(schema, /create table if not exists invoice_line_items/);
  assert.match(schema, /invoice_id uuid not null references invoices\(id\) on delete cascade/);
  assert.match(schema, /create policy "invoice line items internal all"/);
  assert.match(schema, /create policy "invoice line items agency select"/);
  assert.match(schema, /can_access_reservation\(i\.reservation_id\)/);
});

test("final operation snapshots can drive automatic invoice generation", () => {
  assert.match(schema, /create table if not exists reservation_final_operation_snapshots/);
  assert.match(schema, /day_snapshots jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /hotel_snapshot jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /meal_snapshot jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /flight_details jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /bank_account_snapshot jsonb not null default '\{\}'::jsonb/);
  assert.match(schema, /check \(status in \('draft', 'finalized'\)\)/);
  assert.match(schema, /create policy "reservation final operation snapshots internal all"/);
  assert.match(schema, /with check \(has_finance_role\(\) or has_internal_role\(\)\)/);
});

test("guide expense reports preserve actual tour costs for settlement analysis", () => {
  assert.match(schema, /create table if not exists guide_expense_reports/);
  assert.match(schema, /create table if not exists guide_expense_report_lines/);
  assert.match(schema, /reservation_id uuid not null references reservations\(id\) on delete cascade/);
  assert.match(schema, /invoice_id uuid references invoices\(id\) on delete set null/);
  assert.match(schema, /section text not null check \(section in \('lodging', 'meal', 'ticket', 'cash_expense', 'guide_fee', 'shopping', 'other'\)\)/);
  assert.match(schema, /cash_advance_amount numeric/);
  assert.match(schema, /settlement_amount numeric/);
  assert.match(schema, /source_guide_expense_report_line_id uuid references guide_expense_report_lines\(id\)/);
  assert.match(schema, /expenses_source_guide_expense_report_line_idx/);
  assert.match(schema, /create policy "guide expense reports internal all"/);
  assert.match(schema, /create policy "guide expense report lines internal all"/);
  assert.doesNotMatch(schema, /guide expense reports agency/);
});

test("workflow communication ledger keeps portal messages code-scoped", () => {
  assert.match(schema, /create table if not exists workflow_threads/);
  assert.match(schema, /workflow_code text not null unique/);
  assert.match(schema, /agency_inquiry_id uuid references agency_inquiries\(id\)/);
  assert.match(schema, /quote_case_id uuid references quote_cases\(id\)/);
  assert.match(schema, /reservation_id uuid references reservations\(id\)/);
  assert.match(schema, /create table if not exists workflow_messages/);
  assert.match(schema, /sender_type text not null check \(sender_type in \('agency', 'internal', 'system'\)\)/);
  assert.match(schema, /visibility text not null default 'partner_visible'/);
  assert.match(schema, /create table if not exists workflow_action_items/);
  assert.match(schema, /partner_visible boolean not null default true/);
  assert.match(schema, /create policy "workflow threads agency select"/);
  assert.match(schema, /create policy "workflow messages agency select"/);
  assert.match(schema, /visibility = 'partner_visible'/);
  assert.match(schema, /create policy "workflow action items agency select"/);
});

test("agency onboarding requires internal approval and preserves account governance logs", () => {
  assert.match(schema, /create type agency_application_status as enum \('pending', 'approved', 'rejected'\)/);
  assert.match(schema, /create table if not exists agency_signup_applications/);
  assert.match(schema, /company_name text not null/);
  assert.match(schema, /email citext not null/);
  assert.match(schema, /country_code text not null/);
  assert.match(schema, /create policy "agency signup applications public insert"/);
  assert.match(schema, /create policy "agency signup applications internal all"/);
  assert.match(schema, /add column if not exists lifecycle_status agency_lifecycle_status/);
  assert.match(schema, /add column if not exists account_role agency_user_role/);
  assert.match(schema, /add column if not exists password_reset_required boolean not null default true/);
  assert.match(schema, /create table if not exists agency_account_email_events/);
  assert.match(schema, /create table if not exists agency_login_events/);
  assert.match(schema, /create policy "agency account email events internal all"/);
  assert.match(schema, /create policy "agency login events internal all"/);
});

test("country references are shared between exchange rates and partner signup", () => {
  assert.match(schema, /create table if not exists country_references/);
  assert.match(schema, /country_code text primary key/);
  assert.match(schema, /country_name text not null/);
  assert.match(schema, /default_currency text/);
  assert.match(schema, /aliases jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /add column if not exists original_country_name text/);
  assert.match(schema, /from exchange_rates/);
  assert.match(schema, /create policy "country references public active select"/);
  assert.match(schema, /create policy "country references internal all"/);
});

test("api error responses do not expose internal server messages", () => {
  assert.match(apiHttp, /function publicErrorMessage\(error: HttpError\)/);
  assert.match(apiHttp, /if \(error\.status >= 500\)/);
  assert.match(apiHttp, /return "Internal server error"/);
  assert.doesNotMatch(apiHttp, /return jsonResponse\(\{ error: error\.message \}, \{ status: 500 \}\)/);
});

test("agency portal queries stay customer-safe", () => {
  assert.doesNotMatch(agencyPortalQueries, /quote_items/);
  assert.doesNotMatch(agencyPortalQueries, /supplier_prices/);
  assert.doesNotMatch(agencyPortalQueries, /supplier_message_outbox/);
  assert.doesNotMatch(agencyPortalQueries, /settlements/);
  assert.doesNotMatch(agencyPortalQueries, /expenses/);
  assert.doesNotMatch(agencyPortalQueries, /shopping_commissions/);
  assert.doesNotMatch(agencyPortalQueries, /reference_no/);
  assert.doesNotMatch(agencyPortalQueries, /passport_no/);
});

test("local seed covers the v1 demo workflow surface", () => {
  for (const tableName of [
    "companies",
    "profiles",
    "agency_accounts",
    "domestic_suppliers",
    "supplier_products",
    "supplier_prices",
    "agency_inquiries",
    "quote_cases",
    "quote_versions",
    "quote_itinerary_days",
    "quote_items",
    "quote_exports",
    "reservations",
    "rooming_lists",
    "passengers",
    "operation_tasks",
    "supplier_message_outbox",
    "supplier_message_events",
    "invoices",
    "payments",
    "expenses",
    "settlements",
    "email_threads",
    "migration_batches",
    "audit_logs",
    "api_logs"
  ]) {
    assert.match(seedSql, new RegExp(`insert into ${tableName}\\b`));
  }

  assert.match(seedSql, /demo-admin@junghotravel\.local/);
  assert.match(seedSql, /JHT-2026-DEMO-001/);
  assert.match(seedSql, /Demo provider timeout for failed jobs view/);
  assert.doesNotMatch(seedSql, /\?/);
});

test("package exposes v1 verification commands", () => {
  assert.equal(packageJson.scripts["verify:env"], "node scripts/verify-env.mjs");
  assert.equal(packageJson.scripts["verify:schema"], "node scripts/verify-schema.mjs");
  assert.equal(packageJson.scripts["verify:seed"], "node scripts/verify-seed.mjs");
  assert.equal(packageJson.scripts["verify:api-guards"], "node scripts/verify-api-guards.mjs");
  assert.equal(packageJson.scripts["verify:api-body-order"], "node scripts/verify-api-body-order.mjs");
  assert.equal(packageJson.scripts["verify:api-responses"], "node scripts/verify-api-responses.mjs");
  assert.equal(packageJson.scripts["verify:api-contract"], "node scripts/verify-api-contract.mjs");
  assert.equal(packageJson.scripts["verify:repo-safety"], "node scripts/verify-repo-safety.mjs");
  assert.equal(packageJson.scripts["verify:security-config"], "node scripts/verify-security-config.mjs");
  assert.equal(packageJson.scripts["verify:launch-runbook"], "node scripts/verify-launch-runbook.mjs");
  assert.equal(packageJson.scripts["verify:page-smoke"], "node scripts/verify-page-smoke.mjs");
  assert.equal(packageJson.scripts["verify:app-route-smoke"], "node scripts/verify-app-route-smoke.mjs");
  assert.match(packageJson.scripts["verify:v1"], /verify:env/);
  assert.match(packageJson.scripts["verify:v1"], /verify:schema/);
  assert.match(packageJson.scripts["verify:v1"], /verify:seed/);
  assert.match(packageJson.scripts["verify:v1"], /verify:api-guards/);
  assert.match(packageJson.scripts["verify:v1"], /verify:api-body-order/);
  assert.match(packageJson.scripts["verify:v1"], /verify:api-responses/);
  assert.match(packageJson.scripts["verify:v1"], /verify:api-contract/);
  assert.match(packageJson.scripts["verify:v1"], /verify:repo-safety/);
  assert.match(packageJson.scripts["verify:v1"], /verify:security-config/);
  assert.match(packageJson.scripts["verify:v1"], /verify:launch-runbook/);
  assert.match(packageJson.scripts["verify:v1"], /verify:page-smoke/);
  assert.match(packageJson.scripts["verify:v1"], /verify:app-route-smoke/);
  assert.match(packageJson.scripts["verify:v1"], /smoke:runtime/);
});

test("launch runbook covers real Supabase and domain handoff", () => {
  for (const expected of [
    "npm run verify:v1",
    "supabase db push",
    "supabase/migrations/202605100001_initial_schema.sql",
    "supabase/migrations/202606260001_gmail_match_candidates.sql",
    "supabase/migrations/202606270001_quote_excel_model.sql",
    "supabase/migrations/202606270002_quote_fare_options.sql",
    "supabase/migrations/202606270003_quote_presentation_blocks.sql",
    "supabase/migrations/202606270004_supplier_media_attachments.sql",
    "Do not load demo users",
    "EXPORT_STORAGE_BUCKET",
    "INITIAL_ADMIN_BOOTSTRAP_SECRET",
    "Domain And Auth Redirects",
    "RLS/policy coverage",
    "POST /api/gmail/webhook",
    "GET /api/health",
    "X-Frame-Options: DENY",
    "API route guard audit",
    "API body-order audit",
    "API response audit",
    "API contract audit",
    "Repository safety scan",
    "Security config audit",
    "Launch runbook audit",
    "Page smoke coverage audit",
    "App route smoke coverage audit",
    "POST /api/automation/reminders/run",
    "Agency Portal boundary QA"
  ]) {
    assert.match(launchRunbook, new RegExp(escapeRegExp(expected)));
  }

  assert.doesNotMatch(launchRunbook, /SUPABASE_SERVICE_ROLE_KEY=\S+/);
  assert.doesNotMatch(launchRunbook, /GMAIL_WEBHOOK_SECRET=\S+/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

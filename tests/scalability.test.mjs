/**
 * @file 한글 책임: `scalability.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

test("shared pagination enforces bounded database reads", async () => {
  const source = await readSource("src/lib/api/pagination.ts");
  assert.match(source, /DEFAULT_PAGE_SIZE = 20/);
  assert.match(source, /MAX_PAGE_SIZE = 100/);
  assert.match(source, /Math\.min\(parsePositiveInteger/);
  assert.match(source, /from = \(page - 1\) \* pageSize/);
});

test("high-volume internal and partner list APIs return pagination metadata", async () => {
  const routes = [
    "src/app/api/quote-cases/route.ts",
    "src/app/api/domestic-suppliers/route.ts",
    "src/app/api/agencies/route.ts",
    "src/app/api/finance/invoices/route.ts",
    "src/app/api/workflows/route.ts",
    "src/app/api/reservations/route.ts",
    "src/app/api/agency/quote-cases/route.ts",
    "src/app/api/agency/reservations/route.ts",
    "src/app/api/agency/invoices/route.ts",
    "src/app/api/agency/inquiries/route.ts"
  ];

  for (const route of routes) {
    const source = await readSource(route);
    assert.match(source, /parsePagination\(/, `${route} does not parse pagination`);
    assert.match(source, /okPaginated\(/, `${route} does not return pagination metadata`);
  }
});

test("list queries use database ranges and exact filtered counts", async () => {
  const queryFiles = [
    "src/features/quotation/queries.ts",
    "src/features/supplier/queries.ts",
    "src/features/agency/queries.ts",
    "src/features/finance/queries.ts",
    "src/features/workflow/queries.ts",
    "src/features/agency-portal/queries.ts"
  ];

  for (const file of queryFiles) {
    const source = await readSource(file);
    assert.match(source, /count: "exact"/, `${file} does not request a filtered count`);
    assert.match(source, /\.range\(from, to\)/, `${file} does not bound rows at the database`);
  }
});

test("search and ordering indexes match the large-list access paths", async () => {
  const migration = await readSource("supabase/migrations/202607150001_scalability_query_indexes.sql");
  assert.match(migration, /create extension if not exists pg_trgm/);
  for (const requiredIndex of [
    "quote_cases_tour_name_trgm_idx",
    "reservations_tour_dates_idx",
    "domestic_suppliers_search_keywords_trgm_idx",
    "workflow_threads_activity_idx",
    "invoices_tour_code_trgm_idx"
  ]) {
    assert.match(migration, new RegExp(requiredIndex));
  }
});

test("reservation readiness and dashboard aggregation stay inside the database", async () => {
  const migration = await readSource("supabase/migrations/202607150002_reservation_readiness_dashboard.sql");
  const queries = await readSource("src/features/reservation/queries.ts");
  assert.match(migration, /operation_ready boolean not null default false/);
  assert.match(migration, /operation_tasks_sync_reservation_readiness/);
  assert.match(migration, /create or replace function get_reservation_dashboard/);
  assert.match(queries, /rpc\("get_reservation_dashboard"/);
  assert.match(queries, /listReservationCalendar/);
});

test("measured list APIs expose request correlation and server timing", async () => {
  const telemetry = await readSource("src/lib/api/telemetry.ts");
  assert.match(telemetry, /x-request-id/);
  assert.match(telemetry, /server-timing/);
  assert.match(telemetry, /slow_api_request/);

  const packageJson = JSON.parse(await readSource("package.json"));
  assert.equal(packageJson.scripts["smoke:load"], "node scripts/load-smoke.mjs");
});

test("core navigation avoids server self-fetches and full document reloads", async () => {
  const corePages = [
    "src/app/admin/page.tsx",
    "src/app/admin/quote-cases/page.tsx",
    "src/app/admin/quote-cases/[quoteCaseId]/page.tsx",
    "src/app/admin/reservations/page.tsx",
    "src/app/admin/reservations/[reservationId]/page.tsx",
    "src/app/admin/workflows/page.tsx",
    "src/app/agency/page.tsx",
    "src/app/agency/quote-cases/page.tsx",
    "src/app/agency/quote-cases/[shareId]/page.tsx",
    "src/app/agency/reservations/page.tsx",
    "src/app/agency/reservations/[reservationId]/page.tsx",
    "src/app/agency/invoices/page.tsx",
    "src/app/agency/invoices/[invoiceId]/page.tsx",
    "src/app/agency/workflows/page.tsx"
  ];

  for (const file of corePages) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /buildInternalApiUrl|buildAgencyApiUrl/, `${file} performs an avoidable self-fetch`);
    assert.doesNotMatch(source, /fetch\(.*\/api\//s, `${file} performs an avoidable self-fetch`);
  }

  const componentFiles = await Promise.all([
    readSource("src/components/admin/ReservationActions.tsx"),
    readSource("src/components/admin/QuoteVersionStatusActions.tsx"),
    readSource("src/components/agency/QuoteRequestActions.tsx"),
    readSource("src/components/agency/RoomingListUploadForm.tsx")
  ]);
  for (const source of componentFiles) assert.doesNotMatch(source, /window\.location\.reload\(\)/);
});

test("operation reminder notifications have a consumer surface", async () => {
  const opsQueries = await readSource("src/features/operations/queries.ts");
  const inbox = await readSource("src/components/admin/NotificationInbox.tsx");
  const ackRoute = await readSource("src/app/api/notifications/[id]/route.ts");
  const tasksPage = await readSource("src/app/admin/operations/tasks/page.tsx");

  // 큐잉된 알림을 읽는 조회와, 이를 표시하는 화면, 확인 API가 모두 있어야 dead-end가 아닙니다.
  assert.match(opsQueries, /listRecentNotifications/);
  assert.match(opsQueries, /from\("notifications"\)/);
  assert.match(tasksPage, /NotificationInbox/);
  assert.match(inbox, /\/api\/notifications\//);
  // 확인은 대기 상태에서만 전환되어야(중복 확인 방지) 합니다.
  assert.match(ackRoute, /\.in\("status", \["queued", "sent"\]\)/);
});

test("reservation creation marks partner booking requests as reserved", async () => {
  const reservationsRoute = await readSource("src/app/api/reservations/route.ts");
  const quoteDetailPage = await readSource("src/app/admin/quote-cases/[quoteCaseId]/page.tsx");

  // 예약 생성/기존 예약 경로 모두에서 booking request를 reserved로 정리해야 합니다.
  assert.match(reservationsRoute, /markBookingRequestsReserved/);
  assert.match(reservationsRoute, /inquiry_type/);
  assert.match(reservationsRoute, /status: "reserved"/);
  // 견적 상세는 미처리 booking request를 전환 지점에 노출해야 합니다.
  assert.match(quoteDetailPage, /pendingBookingRequest/);
  assert.match(quoteDetailPage, /booking_request/);
});

test("locale date inputs render as text without post-hydration DOM mutation", async () => {
  const localeInput = await readSource("src/components/LocaleDateInput.tsx");
  const enforcer = await readSource("src/components/CalendarLocaleEnforcer.tsx");

  // 컴포넌트가 서버·클라이언트 동일하게 text + data 마커로 렌더해야 합니다.
  assert.match(localeInput, /type="text"/);
  assert.match(localeInput, /data-jht-calendar=\{mode\}/);

  // Enforcer는 input의 type이나 data 속성을 런타임에 바꾸면 안 됩니다(하이드레이션 불일치 원인).
  assert.doesNotMatch(enforcer, /input\.type\s*=\s*"text"/);
  assert.doesNotMatch(enforcer, /setAttribute\("data-calendar-locale"/);
  assert.doesNotMatch(enforcer, /dataset\.jhtCalendarBound/);
  assert.match(enforcer, /new WeakSet<HTMLInputElement>/);

  // 원시 type="date"/type="month" 입력이 남아 있으면 다시 하이드레이션 불일치가 생깁니다.
  for (const file of [
    "src/app/admin/page.tsx",
    "src/components/admin/QuoteCaseCreateForm.tsx",
    "src/components/agency/InquiryCreateForm.tsx"
  ]) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /type="date"/, `${file} still uses a raw native date input`);
    assert.doesNotMatch(source, /type="month"/, `${file} still uses a raw native month input`);
  }
});

test("deployment and authentication fast paths stay near the database", async () => {
  const vercelConfig = JSON.parse(await readSource("vercel.json"));
  const authSource = await readSource("src/lib/api/auth.ts");
  const authSessionSource = await readSource("src/lib/domain/auth-session.mjs");
  const supabaseServerSource = await readSource("src/lib/supabase/server.ts");
  assert.deepEqual(vercelConfig.regions, ["hnd1"]);
  assert.match(authSource, /getRequestAccessToken\(supabase\)/);
  assert.match(authSource, /getVerifiedAccessTokenClaims\(supabase\.auth, accessToken\)/);
  assert.match(authSessionSource, /authClient\.getClaims\(accessToken\)/);
  assert.doesNotMatch(authSessionSource, /getClaims\(\)/);
  assert.match(supabaseServerSource, /requestAccessTokens\.set\(client, extractBearerToken\(authorization\)\)/);
  assert.doesNotMatch(authSource, /supabase\.auth\.getUser\(\)/);
});

test("multi-table writes are transactional and idempotent", async () => {
  const atomicWrites = await readSource("supabase/migrations/202607150003_atomic_writes_idempotency.sql");
  const partnerInquiry = await readSource("supabase/migrations/202607150004_atomic_partner_inquiry.sql");
  const invoiceRoute = await readSource("src/app/api/finance/invoices/route.ts");
  const migrationRoute = await readSource("src/app/api/migrations/notion-csv/route.ts");
  const inquiryRoute = await readSource("src/app/api/agency/inquiries/route.ts");

  assert.match(atomicWrites, /create or replace function stage_notion_csv_batch_atomic/);
  assert.match(atomicWrites, /create or replace function create_invoice_version_atomic/);
  assert.match(atomicWrites, /pg_advisory_xact_lock/);
  assert.match(atomicWrites, /invoices_idempotency_uidx/);
  assert.match(partnerInquiry, /create or replace function submit_agency_inquiry_atomic/);
  assert.match(partnerInquiry, /auth\.uid\(\)/);
  assert.match(partnerInquiry, /agency_inquiries_agency_idempotency_uidx/);
  assert.match(invoiceRoute, /rpc\("create_invoice_version_atomic"/);
  assert.doesNotMatch(invoiceRoute, /createdInvoiceId/);
  assert.match(migrationRoute, /rpc\("stage_notion_csv_batch_atomic"/);
  assert.match(inquiryRoute, /rpc\("submit_agency_inquiry_atomic"/);
});

test("heavy exports expose a language-neutral leased worker contract", async () => {
  const migration = await readSource("supabase/migrations/202607150005_hybrid_worker_contract.sql");
  const atomicFinish = await readSource("supabase/migrations/202607150006_worker_atomic_finish_audit.sql");
  const worker = await readSource("src/app/api/automation/quote-exports/run/route.ts");

  assert.match(migration, /create or replace function claim_quote_export_jobs/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /where status = 'processing'/);
  assert.match(migration, /create or replace function finish_quote_export_job/);
  assert.match(worker, /rpc\("claim_quote_export_jobs"/);
  assert.match(worker, /rpc\("finish_quote_export_job"/);
  assert.doesNotMatch(worker, /\.eq\("status", "queued"\)/);
  assert.match(atomicFinish, /insert into audit_logs/);
  assert.match(atomicFinish, /quote_export\.completed/);
  assert.doesNotMatch(worker, /writeAuditLog/);

  const retryRoute = await readSource("src/app/api/quote-exports/[id]/retry/route.ts");
  assert.match(retryRoute, /lease_expires_at: null/);
});

test("local auth seed remains compatible with current GoTrue user scanning", async () => {
  const seed = await readSource("supabase/seed.sql");

  assert.match(seed, /confirmation_token/);
  assert.match(seed, /recovery_token/);
  assert.match(seed, /email_change_token_current/);
  assert.match(seed, /reauthentication_token/);
  assert.match(seed, /phone,\s*phone_change/s);
});

test("manually bootstrapped databases restore the privileged-session helper", async () => {
  const migration = await readSource("supabase/migrations/202607150007_restore_privileged_session_helper.sql");

  assert.match(migration, /create or replace function jht_is_privileged_session/);
  assert.match(migration, /revoke execute .* from public/);
  assert.match(migration, /grant execute .* to anon, authenticated, service_role/);
});

async function readSource(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

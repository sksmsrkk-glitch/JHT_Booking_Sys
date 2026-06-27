# API Contract

## Public APIs

- `GET /api/health`

## Agency APIs

- `GET /api/agency/inquiries`
- `POST /api/agency/inquiries`
- `GET /api/agency/quote-cases`
- `GET /api/agency/quote-cases/:shareId` (implemented by the shared `:id` route segment; this GET treats the value as `share_id`)
- `POST /api/agency/quote-cases/:id/revision-request`
- `POST /api/agency/quote-cases/:id/booking-request`
- `GET /api/agency/reservations`
- `GET /api/agency/reservations/:id`
- `GET /api/agency/invoices`
- `GET /api/agency/invoices/:id`
- `POST /api/agency/rooming-lists/upload`

## Internal APIs

- `GET /api/agencies`
- `POST /api/agencies`
- `GET /api/agencies/:id`
- `POST /api/agencies/:id/contacts`
- `POST /api/agencies/:id/users`
- `GET /api/companies`
- `POST /api/companies`
- `GET /api/domestic-suppliers`
- `POST /api/domestic-suppliers`
- `GET /api/domestic-suppliers/:id`
- `POST /api/domestic-suppliers/:id/contacts`
- `POST /api/domestic-suppliers/:id/products`
- `POST /api/supplier-products/:id/prices`
- `GET /api/cost-items/search`
- `GET /api/quote-cases`
- `POST /api/quote-cases`
- `GET /api/quote-cases/:id`
- `POST /api/quote-cases/:id/items`
- `POST /api/quote-cases/:id/versions`
- `POST /api/quote-itinerary-days/:id/route-segments`
- `POST /api/quote-versions/:id/export-xlsx`
- `POST /api/quote-versions/:id/presentation-blocks`
- `PATCH /api/quote-versions/:id/public-summary`
- `POST /api/quote-exports/:id/retry`
- `POST /api/quote-versions/:id/itinerary-days`
- `PATCH /api/quote-versions/:id/status`
- `GET /api/reservations`
- `POST /api/reservations`
- `GET /api/reservations/:id`
- `PATCH /api/reservations/:id`
- `POST /api/reservations/:id/generate-operation-tasks`
- `POST /api/reservations/:id/room-assignments`
- `GET /api/operation-tasks`
- `PATCH /api/operation-tasks/:id`
- `POST /api/operation-tasks/:id/remind`
- `GET /api/supplier-messages`
- `GET /api/supplier-messages/:id`
- `POST /api/supplier-messages/draft`
- `POST /api/supplier-messages/:id/approve`
- `POST /api/supplier-messages/:id/send`
- `POST /api/supplier-messages/:id/requeue`
- `POST /api/supplier-messages/provider-callback`
- `GET /api/admin/readiness`
- `POST /api/admin/bootstrap`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/finance/invoices`
- `POST /api/finance/invoices`
- `GET /api/finance/invoices/:id`
- `POST /api/finance/invoices/:id/payments`
- `GET /api/finance/settlements`
- `POST /api/finance/settlements/recalculate`
- `PATCH /api/finance/settlements/:id/status`
- `POST /api/finance/expenses`
- `POST /api/finance/extra-revenues`
- `POST /api/finance/shopping-commissions`
- `POST /api/automation/reminders/run`
- `GET /api/automation/failed-jobs`
- `POST /api/automation/quote-exports/run`
- `POST /api/automation/supplier-messages/run`
- `POST /api/gmail/webhook`
- `POST /api/migrations/notion-csv`
- `GET /api/migrations/notion-csv/batches`
- `PATCH /api/migrations/notion-csv/batches/:id/status`
- `GET /api/automation/gmail-review`
- `PATCH /api/automation/gmail-review/:id`
- `GET /api/audit`
- `GET /api/audit/api-logs`

## Authorization Defaults

- Agency APIs use Supabase RLS through the caller's JWT.
- Agency inquiry, quote revision request, and quote booking request writes create internal audit evidence with agency account/user context.
- Agency booking requests validate the selected/latest quote version is Agency-visible before storing the request payload.
- Agency rooming list uploads verify agency-owned reservations, reject cancelled reservations, generate a storage path when omitted, and mark uploads with passenger rows as parsed.
- Agency reservation detail may show passenger names and service notes for its own reservation, while internal admin detail may show fuller passenger operations data.
- Internal APIs require an internal user role through RLS.
- Company creation is admin-only, normalizes company code to uppercase, preserves the unique code constraint, and writes an audit log.
- Readiness checks are internal-only and expose only environment variable presence, service-role smoke check status, and workflow gate inventory, never secret values.
- Readiness includes a static pre-launch checklist for `verify:v1`, Supabase migrations, local-only seed handling, Storage bucket creation, bootstrap secret rotation, domain/auth redirects, webhook registration, worker scheduling, and Agency Portal boundary confirmation.
- `npm run verify:schema` requires every created table to enable RLS and have at least one policy, while blocking Agency policies on internal-only supplier, finance, audit, migration, and automation tables.
- Initial admin bootstrap requires `x-bootstrap-secret`, uses the service role, upserts the JHT company, creates admin/finance roles for an existing Supabase Auth user, and is rejected once an admin role exists.
- Internal user role management requires admin role, manages existing Supabase Auth users through `profiles`/`user_roles`, validates the optional default company against active companies, and audits role changes.
- Automation endpoints require `x-automation-secret`.
- External provider callbacks require `x-webhook-secret` and the matching provider-specific webhook secret environment variable.
- `npm run verify:api-guards` audits every App Router API handler and fails if a handler lacks an internal, agency, finance, admin, automation, webhook, or bootstrap guard. `/api/health` is the only public API allowlist entry.
- `npm run verify:api-body-order` audits API handlers so request bodies are parsed only after an auth or shared-secret guard.
- `npm run verify:api-responses` audits API handlers so JSON responses go through shared no-store helpers.
- `npm run verify:api-contract` audits this file against `src/app/api/**/route.ts` so implemented handlers and documented handlers stay aligned.
- `npm run verify:repo-safety` blocks non-empty secret assignments, token-shaped values, and local demo credentials outside their explicit allowlist.
- `npm run verify:security-config` audits security headers, HTTPS-aware auth cookie attributes, and launch runbook cookie guidance.
- `npm run verify:launch-runbook` audits the launch runbook against readiness env definitions, storage checks, and migration files.
- `npm run verify:page-smoke` audits App Router page files against production runtime smoke coverage.
- `npm run verify:app-route-smoke` audits non-API App Router route files against production runtime route smoke coverage.
- `npm run smoke:runtime` starts the production build and checks all page routes, all API handlers' unauthenticated guard responses, logout cookie clearing, and baseline security headers.
- JSON API responses and auth session/logout responses include `Cache-Control: no-store`.
- API server errors with status `>= 500` are returned as `Internal server error`; database, RLS, provider, and environment details must stay server-side.
- High-risk actions require approval fields and audit logs.
- API logs are internal-only technical traces for webhook/automation/API support; Gmail webhooks, provider callbacks, and automation workers write sanitized logs that redact secrets, tokens, passport fields, and large message bodies.
- Health checks are public, do not touch the database, and expose only boolean configuration presence.
- Gmail review updates are internal-only, validate selected quote/reservation agency consistency, clear or restore manual review state, and write audit evidence.
- Gmail webhooks are secret-protected, reject duplicate Gmail message IDs, score quote case candidates, store candidate evidence for manual review, and auto-link only high-confidence matches.
- Agency contact and portal user membership writes are internal-only and audit logged; Portal access remains scoped by active agency_users membership.
- Supplier contact, product, and price writes are internal-only and audit logged; Agency Portal must never query supplier contacts/products/prices directly.
- Supplier message drafts validate that a selected supplier contact belongs to the selected domestic supplier and can fall back to reservation/supplier-aware default templates.
- Supplier message draft screens use reservation and domestic supplier selectors, and disable drafting when either side is unavailable.
- Supplier message draft creation rejects cancelled/completed reservations, matching the reservation detail UI lock.
- Supplier message detail is internal-only and may expose rendered body, metadata, approvals, provider message IDs, and provider events for operational tracing.
- Supplier message delivery automation uses `x-automation-secret`, processes queued outbox rows idempotently, records sending/sent/failed provider events, and supports dry-run delivery before live provider credentials are configured.
- Failed supplier messages may be requeued by an internal user only after the original approval rules are still satisfied; requeue clears the error, inserts a queued provider event, and writes audit evidence.
- Failed supplier message and Quote XLSX export jobs are visible in an internal-only recovery queue at `/admin/automation/failed-jobs`.
- Supplier message provider callbacks use the service role, match by idempotency key or provider message ID, append `supplier_message_events`, and update outbox delivery status.
- Reservation status changes must insert `reservation_status_history` and write an audit log.
- Reservation detail UI should show locked operation controls for cancelled/completed reservations.
- Quote item writes are internal-only, draft-version-only, preserve cost snapshots, recalculate quote version totals, and write audit logs.
- Admin quote item screens should allow selecting active Domestic Supplier product/price rows to prefill immutable cost snapshot fields before save.
- Quote version creation is internal-only, rejects duplicate drafts, and may copy itinerary, route segments, and quote item snapshots from the latest/source version.
- Quote itinerary day writes are internal-only, draft-version-only, and expose only public itinerary fields to Agency Portal after send.
- Route segment writes are internal-only, draft-version-only through the parent itinerary day, and become Agency-visible only through sent quote versions.
- Quote version status changes are internal-only; sending exposes only customer-safe fields to Agency Portal and must audit the change.
- Quote XLSX export requests are internal-only, reject cancelled/expired or zero-total versions, avoid duplicate active export queue rows, and surface export status on the quote detail page.
- Quote version public summary updates are internal-only, draft/review-only, and store Agency-visible fare options plus Excel source summary without exposing supplier costs.
- Quote presentation blocks are internal-created, draft/review-only, can attach public hotel, meal, attraction, or itinerary images/descriptions to quote versions or itinerary days, and Agency Portal reads only public blocks through sent/accepted/superseded quote versions.
- Quote XLSX export automation uses `x-automation-secret`, processes queued export rows, writes DB snapshot-based XLSX files to Supabase Storage, and marks exports `completed` or `failed` with audit evidence.
- Failed Quote XLSX export rows can be retried by an internal user using the same `.xlsx` storage path; retry clears the error and writes audit evidence.
- Reservation creation is internal-only, requires an accepted quote case/version, writes initial status history, and audits the conversion.
- Room assignment creation is internal-only, rejects cancelled/completed reservations, validates all passenger IDs and the optional rooming list belong to the reservation, and audits the room grouping.
- Operation task generation and updates are internal-only, reject cancelled/completed reservations, validate task status, require a blocked reason for blocked tasks, maintain completed timestamps, validate linked domestic suppliers, and audit before/after data.
- Operation task reminders are internal/automation-only, reject terminal `done`/`cancelled` tasks for both automated and manual reminder paths, and manual reminder queueing writes audit evidence.
- Invoice creation is finance/admin-only, requires a non-cancelled reservation with an accepted quote version, rejects reservations with closed settlements, defaults to the accepted public quote total, and audits the invoice.
- Payment writes require finance/admin role, idempotency keys, invoice status refresh, and high-risk audit logs.
- Internal and Agency invoice detail pages expose printable invoice views that show only invoice totals, confirmed payments, balance due, and agency-safe payment summaries; Agency responses omit internal payment reference numbers.
- Expense, extra revenue, shopping commission, settlement recalculation, and settlement status changes are finance/admin-only and audit logged; finance pages should use reservation and supplier selectors instead of raw UUID entry for routine operation.
- Finance entries, including invoice creation, adjustments, and payment writes, must be rejected once a reservation settlement is `closed`.
- Notion CSV migration batches are internal-only; validation writes `staging_rows.validation_status`, stores row-level `migration_errors`, approval is allowed only after a validated batch has no errors, and import inserts valid mapped rows into the approved target table with high-risk audit evidence.

## Browser Session

- `/auth/login` signs in with Supabase email/password and posts the access token to `/auth/session`.
- `POST /auth/session` stores the access token in the `jht_access_token` HttpOnly cookie for v1 server-rendered page requests, aligns cookie Max-Age with the Supabase session expiry, and rejects mismatched `Origin` headers.
- API routes accept either an `Authorization: Bearer ...` header or the `jht_access_token` cookie.
- `/auth/logout` clears the cookie.

## Local Demo Seed

- `npm run verify:env` checks that `.env.example` and `/admin/readiness` environment requirements stay aligned.
- `npm run verify:schema` checks that migrations, RLS policies, readiness smoke tables, and local seed table names stay aligned.
- `npm run verify:api-guards` checks that API route handlers stay protected unless explicitly allowlisted as public.
- `npm run verify:api-body-order` checks that API route handlers authenticate or validate shared secrets before parsing request bodies.
- `npm run verify:api-responses` checks that API route handlers use shared no-store JSON response helpers.
- `npm run verify:api-contract` checks that `docs/api-contract.md` and implemented API handlers stay aligned.
- `npm run verify:repo-safety` checks that repository files do not carry production secrets or misplaced local demo credentials.
- `npm run verify:security-config` checks security headers, HTTPS-aware auth cookie attributes, and launch runbook cookie guidance.
- `npm run verify:launch-runbook` checks that `docs/launch-runbook.md` stays aligned with readiness env definitions, storage checks, and migration files.
- `npm run verify:page-smoke` checks that every App Router page route has a runtime smoke check.
- `npm run verify:app-route-smoke` checks that every non-API App Router route has a runtime route smoke check.
- `supabase/seed.sql` is local-only demo data for v1 verification and includes a full internal workflow sample plus failed automation jobs.
- `npm run verify:seed` checks the seed for required v1 demo tables, stable demo IDs, demo credentials, failed-job samples, and garbled characters.
- Demo credentials and rows must be removed or replaced before connecting a real Supabase project.

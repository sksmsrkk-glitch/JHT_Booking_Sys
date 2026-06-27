# JHT Operations Platform

This repository implements Jungho Travel's v1 inbound travel operations system.

The core domain rule is strict terminology separation:

- `Overseas Agency`: the foreign travel agency customer that requests quotes, sells locally, sends passengers, and pays JHT.
- `Domestic Supplier`: the Korea-side supplier that provides hotel rooms, coaches, restaurants, guides, attractions, and other cost items.

Do not model both concepts as a generic `partner`. Their permissions, accounting flow, communication flow, and data visibility are different.

## Implemented V1 Surface

- Next.js App Router internal admin and Overseas Agency Portal.
- Supabase SQL migration with separated `agency_*` and `domestic_supplier_*` table families.
- Company, internal user, Overseas Agency, Domestic Supplier, contact, product, and pricing master data.
- Quote cases, quote versions, itinerary days, route segments, immutable quote item cost snapshots, agency-safe quote views, revision requests, and booking requests.
- Excel-style quote item metadata for service section, calculation mode, source cell reference, copied formula note, manual override state, supplier-cost breakdown, and public breakdown.
- Public quote fare options for hotel/quotation alternatives, such as proposed hotel, tour fare, single supplement, and customer-safe notes.
- Partner-facing quote presentation blocks for itinerary descriptions, hotel images, menu images, attraction images, and other customer-safe media.
- Reservation conversion, status history, rooming list upload/parsing, passengers, room assignments, default operation task generation, task updates, blocked states, and reminders.
- Supplier message draft, approval, send queue, provider callback, event log, and reservation/supplier-aware template generation.
- Finance invoices, printable invoice views, payments, expenses, extra revenues, shopping commissions, settlement recalculation, approval, close, and closed-state write locks.
- Gmail/manual review, Notion CSV staging, audit log, initial admin bootstrap, browser login cookie session, and V1 readiness checks.
- RLS policies and domain tests that protect the Overseas Agency vs Domestic Supplier boundary, including supplier prices, quote item internals, operation tasks, expenses, settlements, and supplier outbox records.

## Design Documents

- [System Blueprint](docs/system-blueprint.md): full system definition, feature specification, ERD, workflows, directory structure, security, and implementation phases.
- [V1 System Design](docs/system-design.md): current implemented architecture, permission model, workflows, automation, and deployment handoff boundaries.
- [V1 User Guide](docs/user-guide.md): role-based operating guide for internal teams, Overseas Agency users, launch safety, and troubleshooting.
- [Excel-Style Quote System Notes](docs/excel-quote-system.md): quote builder requirements, workbook access status, and implemented spreadsheet-style costing metadata.
- [Code Review And Debug Report](docs/review-debug-report.md): latest review findings, fixes, verification notes, and residual risks.
- [Architecture Plan](docs/architecture.md): short architecture summary.
- [API Contract](docs/api-contract.md): current API route contract.
- [V1 Launch Runbook](docs/launch-runbook.md): real Supabase, domain, webhook, worker, seed, and boundary QA handoff steps.
- [Claude Code Prompt Set](docs/claude-code-prompt-set.md): phased prompts for controlled implementation.
- [Claude Harness Benchmark Sources](docs/claude-harness-benchmark-sources.md): benchmarked Claude Code repositories and patterns used for this project's `CLAUDE.md` and skills.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase setup:

```bash
supabase start
supabase db reset
```

Verification:

```bash
npm run test
npm run typecheck
npm run verify:env
npm run verify:schema
npm run verify:seed
npm run verify:api-guards
npm run verify:api-body-order
npm run verify:api-responses
npm run verify:api-contract
npm run verify:repo-safety
npm run verify:security-config
npm run verify:launch-runbook
npm run verify:page-smoke
npm run verify:app-route-smoke
npm run build
npm run smoke:runtime
npm run verify:v1
```

`smoke:runtime` starts the production Next.js server from the latest `.next` build, checks every App Router page route, verifies every API handler rejects unauthenticated or missing-secret requests, checks logout cookie clearing, and confirms baseline security headers.

`verify:api-guards` checks every `src/app/api/**/route.ts` handler for an auth or shared-secret guard, with only `/api/health` explicitly allowlisted as public.

`verify:api-body-order` checks that API handlers authenticate or validate shared secrets before parsing request bodies.

`verify:api-responses` checks that API routes use the shared no-store response helpers instead of direct JSON responses.

`verify:api-contract` checks that every implemented API handler is listed in `docs/api-contract.md`, and that the contract does not reference missing handlers.

`verify:schema` checks migration, seed, readiness, RLS enablement, and policy coverage alignment. It also blocks accidental Agency policies on internal-only supplier, finance, audit, migration, and automation tables.

`verify:repo-safety` scans source and docs for non-empty secret assignments, token-shaped values, and local demo credentials outside their allowlisted files.

`verify:security-config` checks baseline security headers, HTTPS-aware auth cookie attributes, and launch runbook cookie guidance.

`verify:launch-runbook` checks that the launch runbook stays aligned with readiness env definitions, storage checks, and migration files.

`verify:page-smoke` checks that every `src/app/**/page.tsx` route is represented in the production runtime smoke checks.

`verify:app-route-smoke` checks that every non-API `src/app/**/route.ts` route is represented in the production runtime route smoke checks.

`verify:v1` runs the environment guard, schema/RLS guard, seed guard, API guard audit, API body-order audit, API response audit, API contract audit, repository safety scan, security config audit, launch runbook audit, page smoke coverage audit, app route smoke coverage audit, tests, typecheck, production build, and runtime smoke in sequence. Use it before handing the app to the real Supabase/domain setup step.

The current v1 working surface can be checked at `/admin/readiness` after login. This page reports environment presence, database smoke checks, and workflow gate inventory without exposing secret values.

The readiness page also includes the final handoff checklist for real Supabase/domain setup: run `verify:v1`, apply migrations, create Storage buckets, bootstrap admin, configure domain/auth redirects, register webhooks, schedule workers, and confirm the Agency Portal boundary with a real agency user.

Local Supabase can load `supabase/seed.sql` for a full v1 demo path: master data, quote, accepted reservation, rooming list, operations tasks, supplier message failure, quote export failure, finance records, Gmail linkage, migration staging, audit, and API logs. The local demo admin row is `demo-admin@junghotravel.local` / `JhtDemo!2026`; replace or remove it before any real environment is connected.

Quote XLSX exports are queued from quote version detail pages and processed by `POST /api/automation/quote-exports/run` with `x-automation-secret`. The worker writes generated XLSX files to the Supabase Storage bucket named by `EXPORT_STORAGE_BUCKET` (`exports` by default).

Supplier message delivery is queued from approved outbox records and processed by `POST /api/automation/supplier-messages/run` with `x-automation-secret`. `SUPPLIER_MESSAGE_DELIVERY_MODE=dry_run` keeps v1 safe until live Email/Kakao provider credentials are configured.

Failed Quote XLSX exports and failed supplier message deliveries can be reviewed from `/admin/automation/failed-jobs` or retried from internal admin detail screens. Retry/requeue keeps the original internal row, clears the previous error, and records audit evidence.

API/webhook/automation call traces are visible at `/admin/audit/api-logs`. Logs are sanitized before insert so secrets, tokens, passport fields, provider payloads, and large message bodies are not stored as plain operational traces.

## Safety Rules

- Quote items store snapshots of supplier cost, exchange rate, product names, and margin at the time of quote creation.
- Reservation confirmation, cancellation, supplier change/cancel messages, invoice issuance, payment handling, and settlement approval are high-risk actions.
- High-risk actions must write `audit_logs` and require approval before execution.
- Supplier messages are drafted first. Email/Kakao send is blocked until approved.

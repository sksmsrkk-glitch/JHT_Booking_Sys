# CLAUDE.md

This file guides Claude Code when working on the JHT Operations Platform.

## Project Mission

Build a practical operating system for Jungho Travel's inbound travel business using `Next.js + Supabase`.

The system must support:

- Cost DB for hotels, vehicles, restaurants, attractions, guides, and other domestic services.
- Automated quotation based on immutable cost snapshots.
- Overseas Agency Portal for inquiries, quote review, booking requests, rooming list upload, and invoices.
- Internal Admin for quotation, reservation, operations, supplier communication, and settlement.
- Operation reminders across sales, operations, hotel booking, vehicle booking, guide assignment, content booking, and finance teams.
- Supplier email/Kakao outbox with approval, idempotency, retry, and event logs.
- Gmail matching and Notion CSV migration with manual review gates.

## Business Boundary

This project has one non-negotiable domain boundary:

| Business concept | System term | Table family |
|---|---|---|
| Foreign travel agency customer | `Overseas Agency` | `agency_*` |
| Korea-side service/cost supplier | `Domestic Supplier` | `domestic_suppliers`, `supplier_*` |

Never merge these into a generic `partner` model. Do not use `partner_id` as a shortcut.

Agency data and supplier data have different permissions, accounting flows, communication flows, and user interfaces.

## Required Context

Before architecture, DB, API, automation, or feature work, read the relevant project documents:

- Full blueprint: `docs/system-blueprint.md`
- API contract: `docs/api-contract.md`
- Architecture summary: `docs/architecture.md`
- Current SQL schema: `supabase/migrations/202605100001_initial_schema.sql`
- Domain tests: `tests/domain.test.mjs`
- Schema boundary tests: `tests/schema-boundary.test.mjs`

Use the blueprint as the source of truth when business logic conflicts with implementation details.

## Harness Engineering Workflow

For every meaningful task, create or follow a controllable execution harness:

1. Define the objective.
2. Define business context and system boundary.
3. List constraints, especially auth, RLS, PII, idempotency, and approval gates.
4. Identify inputs, data sources, and expected outputs.
5. Inspect current files before editing.
6. State the planned file changes.
7. Implement the smallest stable slice.
8. Add or update tests.
9. Run verification.
10. Summarize changed files, residual risk, and next action.

Do not jump directly into code when data flow, status lifecycle, or permission boundaries are unclear.

## Skills To Use

Use the project skills in `.claude/skills/` when relevant:

- `jht-architecture-harness`: architecture, feature design, workflow planning.
- `jht-supabase-rls-guard`: schema, migration, RLS, auth, DB consistency.
- `jht-quote-reservation-domain`: cost snapshots, quotations, reservations, rooming lists.
- `jht-automation-comms-harness`: Gmail, reminders, supplier email/Kakao outbox.
- `jht-code-review-verification`: reviewing Claude Code output, validation, release readiness.

## Development Commands

Use these commands from the project root:

```powershell
npm.cmd install
npm.cmd run dev -- -p 3000
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

Supabase:

```powershell
supabase start
supabase db reset
```

If Supabase CLI is unavailable, do not pretend DB validation passed. Say what could not be verified.

## Database Rules

- Enable RLS on every business table.
- Keep `agency_accounts`, `agency_users`, `agency_contacts`, and `agency_inquiries` for Overseas Agency only.
- Keep `domestic_suppliers`, `supplier_contacts`, `supplier_products`, `supplier_prices`, and `supplier_media` for Domestic Supplier only.
- Quote items must store supplier cost, product name, supplier name, currency, exchange rate, quantity, pricing unit, margin mode, and final calculated values as snapshots.
- Reservation status changes must write `reservation_status_history`.
- High-risk actions must write `audit_logs`.
- Duplicate-prone workflows must use unique constraints or idempotency keys.
- Never rely only on frontend validation for quotation, reservation, payment, supplier message, or settlement logic.

## Security Rules

- Agency users can only see their own agency's inquiries, public quote versions, reservations, rooming lists, invoices, and payment summaries.
- Agency users must never see supplier prices, quote item internals, internal margins, expenses, shopping commissions, settlements, operation tasks, or supplier outbox records.
- Domestic Supplier login is out of scope for v1.
- Store service keys, Gmail tokens, Kakao tokens, Google Maps keys, and email provider keys only in server-side environment variables.
- Treat passenger names, passport numbers, dates of birth, dietary requirements, email, phone, and rooming list files as PII.

## High-Risk Actions

These actions require approval and audit logging:

- Reservation confirmation.
- Reservation cancellation.
- Supplier change/cancellation/final confirmation message send.
- Invoice issuance.
- Payment confirmation.
- Settlement approval.
- Bulk email or Kakao send.
- Production data import from Notion CSV staging.

Supplier message automation may create drafts automatically. Sending must be approval-gated.

## API Rules

- Agency APIs must use caller JWT and Supabase RLS.
- Internal APIs must require an internal role.
- Automation APIs must require a secret header.
- Service role clients may only be used in server-side automation/webhook code.
- Return safe error messages. Do not leak SQL details, tokens, or PII.
- Keep request/response schemas stable and update `docs/api-contract.md` when adding routes.

## Frontend Rules

- Build the working operating interface first, not a marketing page.
- Internal admin UI should be dense, scan-friendly, and operational.
- Agency Portal should be simple and clear, exposing only customer-safe information.
- Use explicit loading, empty, error, and permission-denied states.
- Do not expose cost, margin, or settlement data through hidden client props.

## Automation Rules

- Every automation must define trigger, inputs, source data, processing steps, output, duplicate prevention, error handling, logs, retry policy, and human approval point.
- Gmail matching must store confidence and reasons; low confidence goes to manual review.
- Reminder keys must prevent repeated alerts for the same task/rule/date.
- Supplier outbox sends must record provider responses in `supplier_message_events`.
- Kakao failure should create or queue an email fallback when business-critical.

## Verification Rules

After meaningful changes, run the narrowest useful checks first, then broader checks:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

For DB changes, also verify:

- Migration applies cleanly.
- RLS blocks Agency access to supplier prices and quote item internals.
- Unique constraints prevent duplicate reservations, messages, reminders, payments, and uploaded passenger rows.

## Response Format For Completed Work

When finishing a task, report:

- What changed.
- Files changed.
- Commands run and results.
- What was not verified.
- Residual risk.
- Next action.

Keep the response practical and concise.

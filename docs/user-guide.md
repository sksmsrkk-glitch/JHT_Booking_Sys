# JHT Booking System V1 User Guide

Last reviewed: 2026-06-27

## Who Uses The System

| User type | Main workspace | Purpose |
|---|---|---|
| Admin | `/admin` | System setup, users, companies, full operations, approvals, audit |
| Sales | `/admin` | Agencies, inquiries, quote cases, quote versions |
| Operations | `/admin` | Reservations, operation tasks, rooming lists, supplier messages |
| Finance | `/admin` | Invoices, payments, expenses, commissions, settlements |
| Overseas Agency User | `/agency` | Own inquiries, quotes, booking requests, reservations, rooming lists, invoices |

Domestic Supplier login is not part of V1.

## Getting Started Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Optional local Supabase workflow:

```bash
supabase start
supabase db reset
```

Before handoff or deployment:

```bash
npm run verify:v1
```

## Sign In And Session

1. Open `/auth/login`.
2. Sign in with a Supabase email/password account.
3. The app creates a server-issued HttpOnly session cookie.
4. Use `Sign Out` or `/auth/logout` to clear the cookie.

If login succeeds but pages show a role error:

- Internal users need one or more `user_roles`.
- Agency users need an active row in `agency_users`.
- Finance screens require `admin` or `finance`.

## Internal Admin Workflow

### 1. Readiness

Open `/admin/readiness`.

Use this page to confirm:

- Environment variables are present.
- Database smoke checks are ready.
- Workflow gate coverage is visible.
- Launch handoff checklist is complete.

This page does not expose secret values.

### 2. Initial Bootstrap

Open `/admin/bootstrap`.

Use the bootstrap route only for the first admin setup:

- Requires `INITIAL_ADMIN_BOOTSTRAP_SECRET`.
- Creates or links the initial company/profile/roles.
- Is rejected once an admin role exists.
- Rotate or disable the bootstrap secret after setup.

### 3. Company And Internal Users

Use:

- `/admin/companies`
- `/admin/users`

Company codes are normalized to uppercase. Internal users are attached to existing Supabase Auth users and assigned role rows such as `admin`, `sales`, `operations`, `finance`, or team-specific booking roles.

### 4. Overseas Agencies

Use:

- `/admin/agencies`
- `/admin/agencies/[agencyId]`

Typical tasks:

- Create an Overseas Agency account.
- Add agency contacts.
- Add agency portal users.
- Review agency-linked quote/reservation/invoice records.

Do not use Domestic Supplier records for agency customers.

### 5. Domestic Suppliers And Costs

Use:

- `/admin/domestic-suppliers`
- `/admin/domestic-suppliers/[supplierId]`
- `/admin/costing/search`

Typical tasks:

- Create a Domestic Supplier.
- Add supplier contacts.
- Add supplier products.
- Add product prices.
- Search active supplier cost items when building quotes.

Agency Portal users must never see supplier prices or supplier contact records.

### 6. Quote Cases

Use:

- `/admin/quote-cases`
- `/admin/quote-cases/[quoteCaseId]`

Typical quote flow:

1. Create a quote case for an Overseas Agency.
2. Create a draft quote version.
3. Add itinerary days and route segments.
4. Add quote items from cost search results.
5. Save cost snapshots, margins, quantities, and public totals.
6. Move the quote version to a sendable status.
7. Queue XLSX export if needed.

Quote items store immutable supplier cost snapshots. Later supplier price edits must not rewrite historical quote item costs.

### 7. Reservations And Operations

Use:

- `/admin/reservations`
- `/admin/reservations/[reservationId]`
- `/admin/operations/tasks`

Typical reservation flow:

1. Create a reservation from an accepted quote case/version.
2. Confirm status history is written.
3. Generate default operation tasks.
4. Upload or review rooming list data.
5. Add room assignments.
6. Update task status and blocked reason.
7. Send manual reminders when needed.

Cancelled or completed reservations lock operational changes.

### 8. Supplier Messages

Use:

- `/admin/supplier-messages`
- `/admin/supplier-messages/[messageId]`
- `/admin/automation/failed-jobs`

Typical supplier message flow:

1. Create a draft from reservation and Domestic Supplier context.
2. Review recipient, channel, rendered body, and metadata.
3. Approve the message.
4. Queue for send.
5. Run the supplier message worker.
6. Review provider events.
7. Requeue failed messages only after approval rules are still satisfied.

Cancellation messages require second approval. V1 should stay in dry-run delivery mode until live provider credentials and approval operations are confirmed.

### 9. Finance

Use:

- `/admin/finance/invoices`
- `/admin/finance/invoices/[invoiceId]`
- `/admin/finance/settlements`

Typical finance flow:

1. Create invoice from reservation/accepted quote.
2. Register payments with idempotency keys.
3. Add expenses, extra revenues, and shopping commissions.
4. Recalculate settlement.
5. Approve settlement.
6. Close settlement when final.

Closed settlements reject later invoice, payment, expense, revenue, commission, and settlement changes.

### 10. Automation And Audit

Use:

- `/admin/automation/gmail-review`
- `/admin/automation/failed-jobs`
- `/admin/migrations/notion-csv`
- `/admin/audit`
- `/admin/audit/api-logs`

Rules:

- Gmail low-confidence matches go to manual review.
- Notion CSV imports must validate before approval and import.
- Failed supplier messages and quote exports can be retried from the failed jobs view.
- API logs are sanitized and internal-only.
- High-risk actions must leave audit evidence.

## Overseas Agency Portal Workflow

### 1. Home

Open `/agency`.

Agency users only see their own company-safe workspace.

### 2. Inquiries

Use:

- `/agency/inquiries`
- `/agency/inquiries/new`

Agency users can create and review their own inquiries.

### 3. Quotes

Use:

- `/agency/quote-cases`
- `/agency/quote-cases/[shareId]`

Agency users can:

- View public quote status.
- View public itinerary and route summary.
- View public total amount.
- Request revision.
- Request booking.

Agency users cannot see supplier costs, quote items, internal notes, margins, or settlement data.

### 4. Reservations And Rooming Lists

Use:

- `/agency/reservations`
- `/agency/reservations/[reservationId]`
- `/agency/reservations/[reservationId]/rooming-lists`

Agency users can view their own reservations and upload rooming list files. Cancelled reservations reject new rooming list uploads.

### 5. Invoices

Use:

- `/agency/invoices`
- `/agency/invoices/[invoiceId]`

Agency users can view invoice totals, confirmed payments, and balance due. Internal payment references are omitted.

## Operational Safety Checklist

Before using production data:

- Confirm `npm run verify:v1` passes.
- Confirm real Supabase migrations are applied.
- Confirm demo seed users are not loaded.
- Confirm Storage buckets exist.
- Confirm domain and Supabase Auth redirect URLs are configured.
- Confirm `SUPPLIER_MESSAGE_DELIVERY_MODE=dry_run` until provider testing is complete.
- Confirm webhook and automation secrets are rotated.
- Confirm a real agency test user cannot access supplier prices, quote item internals, operation tasks, expenses, commissions, settlements, or supplier outbox records.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Login works but admin pages show role error | Missing `user_roles` row | Assign an internal role |
| Agency portal shows permission error | Missing or inactive `agency_users` row | Activate the agency user membership |
| Finance page denies access | User is not `admin` or `finance` | Add finance/admin role |
| API returns `Authentication is required` | Missing JWT/cookie | Sign in again or send Authorization header |
| Automation returns invalid secret | Wrong secret header | Check `x-automation-secret` |
| Webhook returns invalid secret | Wrong webhook secret | Check provider/webhook secret configuration |
| Export or supplier delivery failed | Worker/provider/storage issue | Review `/admin/automation/failed-jobs` and `/admin/audit/api-logs` |
| `verify:v1` fails at runtime smoke | Build/server route mismatch | Run the failing verifier directly and inspect the named route |

## Support Commands

```bash
npm run test
npm run typecheck
npm run build
npm run smoke:runtime
npm run verify:v1
```

Use `npm run verify:v1` as the release gate.

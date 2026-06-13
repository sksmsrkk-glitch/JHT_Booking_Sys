---
name: jht-supabase-rls-guard
description: Use when creating or modifying Supabase/PostgreSQL schema, migrations, RLS policies, auth logic, API data access, finance permissions, PII storage, or database consistency rules for the JHT Operations Platform.
---

# JHT Supabase RLS Guard

Use this skill for every database or data-access change.

## Required Reading

- `supabase/migrations/202605100001_initial_schema.sql`
- `tests/schema-boundary.test.mjs`
- `src/lib/api/auth.ts`
- `docs/system-blueprint.md` sections 2, 5, 6, 11, and 12 when needed.

## Non-Negotiable Data Boundary

Keep customer and supplier models separate:

- Overseas Agency tables: `agency_accounts`, `agency_users`, `agency_contacts`, `agency_inquiries`.
- Domestic Supplier tables: `domestic_suppliers`, `supplier_contacts`, `supplier_products`, `supplier_prices`, `supplier_media`.

Do not add `partners`, `partner_users`, `partner_prices`, or `partner_id`.

## Migration Checklist

Before adding a migration, define:

- Entity purpose.
- Owner/user type.
- Key fields.
- Relationships and foreign keys.
- Unique constraints.
- Indexes.
- Status lifecycle.
- Audit log requirements.
- RLS policies.
- Migration/rollback risk.

## RLS Checklist

Every business table must have RLS enabled.

Agency allowed:

- Own `agency_accounts` select.
- Own `agency_users` select/self update.
- Own `agency_contacts` select.
- Own `agency_inquiries` select/insert.
- Own `quote_cases` select.
- Sent/accepted/superseded quote version public data.
- Own `reservations` select.
- Own rooming list/passenger insert/select.
- Own invoice/payment summary select.

Agency forbidden:

- `domestic_suppliers`
- `supplier_contacts`
- `supplier_products`
- `supplier_prices`
- `supplier_media`
- `quote_items`
- `operation_tasks`
- `supplier_message_outbox`
- `expenses`
- `extra_revenues`
- `shopping_commissions`
- `settlements`
- `audit_logs`
- `api_logs`

## High-Risk Constraints

Enforce with DB constraints where possible:

- Supplier message cannot be queued/sent without approval.
- Cancellation supplier message cannot be queued/sent without second approval.
- Payment idempotency keys must be unique when present.
- Reminder idempotency keys must be unique.
- Gmail message IDs must be unique.
- Rooming list upload keys or `(reservation_id, revision_no)` must prevent duplicates.

## API Data Access Rules

- Agency routes use request JWT and RLS.
- Internal routes require internal roles before writes.
- Automation/webhook routes may use service role only after secret validation.
- Finance write routes require finance/admin role.
- Do not move authorization checks to frontend only.

## Verification

After DB or auth changes, run:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

If Supabase CLI is available, also run:

```powershell
supabase db reset
```

Add or update schema-boundary tests for any permission-sensitive change.

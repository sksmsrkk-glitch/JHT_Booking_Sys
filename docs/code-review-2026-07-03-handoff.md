# Code Review Remediation Handoff — 2026-07-03

This document is the handoff for whoever (Codex or a teammate) continues after the
2026-07-03 security/correctness review. It records what changed, what is intentionally
left, what must be verified in a real environment, and the two business decisions that
gate the next phase.

## Commits in this remediation

1. `feat(security): P0 hardening migration for RLS, snapshots, and duplicate guards`
   - `supabase/migrations/202607030001_security_hardening.sql` (additive; **no existing
     migration was edited**), `supabase/seed.sql` guard, 13 schema-boundary tests.
2. `feat(domain): enforce reservation/settlement/payment invariants server-side`
   - New domain modules `src/lib/domain/{reservations,settlement,payments}.mjs`, wired
     into the reservation / settlement / payment / invoice routes, demo-mode gating,
     timing-safe secrets, 5 domain tests.
3. `fix(automation,ui): atomic claims, idempotency guards, and safe fetch handling`
   - Outbox worker, supplier draft, Notion import, bootstrap, and three frontend
     components; new `src/lib/client/api.ts` helper.

Verification at each commit: `npm run test` (78 pass), `npm run typecheck`,
`npm run build`, `npm run verify:api-*` all green.

## MUST DO before deploying — not verifiable in this environment

- **Apply the new migration against a real database.** The Supabase CLI was not
  available here, so `202607030001_security_hardening.sql` was validated by SQL review
  and the string-level schema tests only. Run `supabase db reset` (local) and
  `supabase db push` (hosted) and confirm it applies cleanly. Pay special attention to:
  - The FK swaps to `ON DELETE RESTRICT` assume the default FK constraint names
    (`<table>_<column>_fkey`). If any were renamed, adjust the `drop constraint`
    lines.
  - `alter table payments alter column idempotency_key set not null` backfills nulls
    with the row id first; confirm no null remains in your data.
  - The `partner_receivable_ledger -> agency_receivable_ledger` rename: no app code
    referenced the old table. The Codex takeover updated the stale `docs/` and
    `README.md` references.
- **RLS runtime behavior was not executed.** The policies/triggers are written to the
  documented intent but were not exercised against a live Postgres with real JWTs.
  Smoke-test at least: an agency JWT cannot `update agency_users` protected columns;
  an agency JWT cannot `select internal_total_margin_krw` on `quote_versions`;
  reservation status change writes a history row via the trigger.

## Intentionally deferred (Medium/Low from the review, safe to schedule)

- Broad frontend `try/catch` sweep: only the highest-risk forms (payment, reservation
  status, Notion staging) were migrated to `submitJson()`. The remaining ~20 mutation
  components under `src/components/admin/**` and `src/components/agency/**` should be
  moved to `submitJson()` too — mechanical, low-risk. A background task chip was filed.
- Room assignment validation (capacity, duplicate passenger, check-in/out order) is
  still missing in `POST /api/reservations/:id/room-assignments`.
- Rooming-list re-upload replace-set semantics were completed in the Codex takeover:
  the upload route now rejects duplicate `passengerNo` values and removes passengers
  omitted from the latest parsed upload.
- Kakao->email fallback on high-risk send failure (`automation/supplier-messages/run`).
- Reminder delivery: notifications are still only queued; no worker/UI reads them and
  escalation levels do not fan out to team leads/admins. The feature is inert until a
  dispatch path exists.
- Provider-callback state-machine guard (only `sending -> sent/failed` should apply).
- `docs/accounting-receivables-dashboard.md` and `README.md` were updated in the Codex
  takeover to use `agency_receivable_ledger` / `counterparty_agency_name`.
- UI still uses generic "Partner / 파트너" labels; the mandated terms are
  "Overseas Agency / 해외 에이전시".

## Phase 4 — DONE (decisions received, implemented in commit 5)

Both Phase 4 decisions were answered by the user and implemented:

1. **Currency model — decided: KRW internal storage, convert at issuance.** All internal
   amounts (`total_sell_amount`, `public_total_amount`, internal cost/margin) stay in
   KRW. Conversion to the quote currency now happens at invoice issuance via
   `src/lib/domain/currency.mjs` `convertKrwToQuoteCurrency(amountKrw, exchangeRateToKrw)`
   using the version's rate, applied in `src/features/finance/auto-invoice.ts` (line
   items + total). `exchange_rate_to_krw` semantics: 1 quote-currency unit = X KRW, so
   KRW→quote divides by the rate; KRW quotes (rate 1) are unchanged. Agency-portal
   list/detail displays now apply the same helper so public totals are shown in the
   quoted currency while the stored amount remains KRW.
2. **Margin column exposure — decided: separate table.** Migration
   `202607040001_quote_version_internals.sql` creates the internal-only
   `quote_version_internals` table, backfills it, updates the Phase 1
   `guard_quote_version_amounts` trigger to drop the moved columns, adds an immutability
   trigger, and drops `internal_total_cost_krw` / `internal_total_margin_krw` /
   `default_margin_rate` from `quote_versions`. App code updated:
   `quote-cases/route.ts`, `quote-cases/[id]/versions/route.ts`,
   `quote-cases/[id]/items/route.ts`, `features/quotation/queries.ts` (joins the new
   table), and `seed.sql`. **This migration drops columns — apply and verify against a
   real DB before deploy (see the MUST DO section).**

## New building blocks Codex should reuse (don't re-implement)

- `src/lib/domain/reservations.mjs` — `planReservationStatusChange`,
  `RESERVATION_STATUSES`, `HIGH_RISK_RESERVATION_STATUSES`.
- `src/lib/domain/settlement.mjs` — `computeSettlementTotals`, `selectActiveInvoices`,
  `roundMoney`.
- `src/lib/domain/payments.mjs` — `validatePaymentInput`, `resolveInvoicePaymentState`.
- `src/lib/domain/currency.mjs` — `convertKrwToQuoteCurrency` (KRW→quote currency at issuance).
- DB: `quote_version_internals` table holds internal cost/margin/default-margin-rate;
  read it via join (internal only). Do NOT re-add these columns to `quote_versions`.
- `src/lib/api/guards.ts` — `isDemoModeEnabled()`, timing-safe secret comparison.
- `src/lib/client/api.ts` — `submitJson()` for all client mutations.
- DB: `update_reservation_status(uuid, reservation_status, text)` RPC (records history
  via trigger); `system_flags` one-shot table; `jht_is_privileged_session()` helper used
  by the guard triggers.

## New environment variables

- `JHT_DEMO_MODE=on` — enables preview/demo responses (non-production only). Leave unset
  in production.
- `SUPPLIER_MESSAGE_ALLOW_UNIMPLEMENTED_LIVE=on` — escape hatch that lets the outbox
  worker mark messages `sent` in live mode before a real provider exists. **Do not set
  this in production** until an email/Kakao provider is actually integrated.
- Demo seed on a hosted (SSL) connection is refused unless the session sets
  `app.jht_allow_demo_seed = 'on'`.

## Contract changes (already reflected in `docs/api-contract.md`)

- Payment POST: `idempotencyKey` required (400), currency must match invoice, replay
  returns 200 with the existing payment.
- Supplier draft POST: 409 when the key is already past `draft`/`failed`.
- Reservation PATCH: reason required for confirm/cancel, invalid transitions 400.
- Invoice POST: defaults to `draft`; issuing is finance-only + high-risk.
- Preview responses require `JHT_DEMO_MODE=on`; otherwise 401/403.

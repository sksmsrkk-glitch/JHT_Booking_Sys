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
    referenced the old table, but `docs/` and `README.md` still mention it (see below).
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
- Rooming-list re-upload replace-set semantics: Phase 1 added the passenger
  update/delete RLS policies that unblock it, but the upload route still upserts by
  `(reservation_id, passenger_no)` and does not delete removed passengers. Finish the
  route-side replace-set + duplicate `passengerNo` pre-check.
- Kakao->email fallback on high-risk send failure (`automation/supplier-messages/run`).
- Reminder delivery: notifications are still only queued; no worker/UI reads them and
  escalation levels do not fan out to team leads/admins. The feature is inert until a
  dispatch path exists.
- Provider-callback state-machine guard (only `sending -> sent/failed` should apply).
- `docs/accounting-receivables-dashboard.md` and `README.md` still say
  `partner_receivable_ledger` / `partner_name`; update to `agency_receivable_ledger` /
  `counterparty_agency_name`.
- UI still uses generic "Partner / 파트너" labels; the mandated terms are
  "Overseas Agency / 해외 에이전시".

## BLOCKED on business decisions (Phase 4)

Two Critical findings need a decision before implementation, because they change data
meaning, not just code:

1. **Currency model.** Is `quote_versions.public_total_amount` / `quote_items.total_sell_amount`
   stored in KRW or in the quote's own `currency`? Today the math produces a KRW number
   but the version can be labelled MYR, and `quote_exchange_rate_snapshots` are stored
   but never used. The settlement route now *rejects* mixed-currency inputs (422) as a
   stopgap; the real fix is to pick one storage convention and convert at one explicit
   point using the snapshotted rate.
2. **Margin column exposure.** `quote_versions` still carries `internal_total_cost_krw`
   / `internal_total_margin_krw` / `default_margin_rate` on the same row agencies can
   select. Phase 1 did not column-restrict these yet because internal users are also the
   `authenticated` role, so a blanket column revoke would break internal screens. The
   robust fix is to split internal amounts into a `quote_version_internals` table (or a
   security-barrier view), which requires updating Codex's existing quote read/write
   code in the same change.

## New building blocks Codex should reuse (don't re-implement)

- `src/lib/domain/reservations.mjs` — `planReservationStatusChange`,
  `RESERVATION_STATUSES`, `HIGH_RISK_RESERVATION_STATUSES`.
- `src/lib/domain/settlement.mjs` — `computeSettlementTotals`, `selectActiveInvoices`,
  `roundMoney`.
- `src/lib/domain/payments.mjs` — `validatePaymentInput`, `resolveInvoicePaymentState`.
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

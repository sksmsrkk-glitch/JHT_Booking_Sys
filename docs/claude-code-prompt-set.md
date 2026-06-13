# Claude Code Prompt Set

## Phase 1: Inspect Current Structure

Goal: Confirm the project structure, Supabase migration files, and terminology boundary.

Scope:
- Inspect `supabase/migrations`
- Inspect `src/lib/domain`
- Inspect `src/app/api`

Do not change files yet.

Expected output:
- List current modules.
- Confirm `agency_*` and `domestic_supplier_*` are separated.
- Identify missing tests.

Test command:
```bash
npm run test
```

Rule: Avoid unrelated refactoring.

## Phase 2: Identify Problems

Goal: Review schema and route skeletons for safety issues.

Scope:
- RLS policies
- High-risk supplier message approval flow
- Quote snapshot fields

Expected output:
- Critical issues first.
- File-by-file change plan.

Test command:
```bash
npm run test
```

Rule: Do not rename business entities without explaining migration impact.

## Phase 3: Make Minimal Fix

Goal: Fix schema/API/test gaps from Phase 2.

Scope:
- Only files identified in Phase 2.

Expected output:
- Changed files.
- Test commands and results.

Test command:
```bash
npm run test
npm run typecheck
```

Rule: Keep `Overseas Agency` and `Domestic Supplier` separated.

## Phase 4: Add Feature

Goal: Implement one feature slice at a time.

Recommended first feature:
- Domestic supplier product and price CRUD.

Expected output:
- API routes.
- UI screen.
- RLS tests.

Test command:
```bash
npm run test
npm run build
```

Rule: Do not implement real email/Kakao sending until the approval outbox is verified.

## Phase 5: Test and Verify

Goal: Verify business-critical behavior.

Required scenarios:
- Agency cannot see supplier costs.
- Quote item snapshot does not change after supplier price update.
- Cancellation message cannot be sent without second approval.
- Reminder runner does not create duplicate reminders.

## Phase 6: Summarize Changed Files

Goal: Provide a concise implementation summary.

Expected output:
- Changed files.
- Database changes.
- Test results.
- Deployment cautions.

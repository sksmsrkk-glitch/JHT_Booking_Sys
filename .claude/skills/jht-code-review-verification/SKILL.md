---
name: jht-code-review-verification
description: Use when reviewing Claude Code output, validating implementation readiness, checking changed files, preparing release notes, evaluating test coverage, or deciding whether a JHT Operations Platform change is safe to continue.
---

# JHT Code Review and Verification

Use this skill before accepting implementation work or after Claude Code makes changes.

## Review Order

Report issues in this order:

1. Critical business/data bugs.
2. Security and authorization risks.
3. Agency/Supplier boundary violations.
4. Database/schema/RLS problems.
5. API contract mismatches.
6. Missing validation.
7. Automation idempotency gaps.
8. High-risk action approval/audit gaps.
9. Frontend state and data exposure issues.
10. Testing gaps.

Findings must include file paths and line references when available.

## Boundary Review

Check that:

- No generic `partner` abstraction was introduced.
- Agency routes cannot access supplier/cost/finance internal data.
- Supplier message flows are internal-only.
- Quote item internals are hidden from Agency Portal.
- Domestic Supplier login was not added unless explicitly requested.

## Database Review

Check:

- RLS enabled for new business tables.
- Foreign keys are correct.
- Unique constraints protect duplicate-prone actions.
- Status lifecycle is represented.
- Audit logs exist for high-risk actions.
- PII fields are not exposed through public selects.
- Migration is additive or has an explicit backfill/rollback plan.

## API Review

Check:

- Request schema and response schema match frontend calls.
- Internal APIs require internal role.
- Agency APIs use caller JWT and RLS.
- Automation APIs validate secret headers.
- Service role is server-side only.
- Errors are safe and actionable.

## Frontend Review

Check:

- Loading state.
- Empty state.
- Error state.
- Permission denied state.
- No hidden cost/margin/settlement props in Agency views.
- Forms validate required business fields.
- UI labels use `Overseas Agency` and `Domestic Supplier`, not generic partner.

## Automation Review

Check:

- Trigger is explicit.
- Idempotency key exists.
- Logs are written.
- Retry/fallback path exists.
- Human approval point exists for high-risk actions.
- Provider failures do not silently disappear.

## Verification Commands

Prefer this order:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

For database changes, run Supabase migration verification if available:

```powershell
supabase db reset
```

If a command cannot run, state the reason and the residual risk.

## Acceptance Criteria

A change is not done until:

- Relevant tests pass or the missing verification is clearly documented.
- Agency/Supplier boundary is preserved.
- High-risk actions have approval and audit treatment.
- Duplicate-prone workflows have idempotency.
- Changed files are listed.
- Next action is clear.

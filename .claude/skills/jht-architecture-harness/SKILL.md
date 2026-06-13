---
name: jht-architecture-harness
description: Use for JHT Operations Platform architecture planning, feature specification, workflow design, implementation phase planning, or Claude Code prompt planning. Applies to travel-tech operations, overseas agency portal, domestic supplier operations, quotation, reservation, finance, automation, and system blueprint decisions.
---

# JHT Architecture Harness

Use this skill before implementing substantial product, workflow, database, or automation changes.

## Required Reading

Read only what is relevant:

- `docs/system-blueprint.md` for the full system definition.
- `docs/api-contract.md` for current API boundaries.
- `supabase/migrations/202605100001_initial_schema.sql` for current DB reality.
- `docs/claude-code-prompt-set.md` when producing Claude Code prompts.

## Core Boundary

Always preserve the hard split:

- `Overseas Agency`: customer-side foreign travel agency, `agency_*`.
- `Domestic Supplier`: Korea-side supplier/cost provider, `domestic_suppliers` and `supplier_*`.

Never introduce generic `partner` tables, routes, labels, or IDs.

## Harness Output

For architecture work, produce:

1. Objective.
2. Current assumptions.
3. System boundary.
4. Main users and permissions.
5. Main data objects.
6. Component structure.
7. Data flow.
8. External integrations.
9. Failure points.
10. Security risks.
11. Test strategy.
12. Implementation phases.
13. Next action.

For automation work, produce:

1. Purpose.
2. Trigger.
3. Input data.
4. Data sources.
5. Processing steps.
6. Tools/APIs.
7. Output.
8. Duplicate prevention.
9. Error handling.
10. Logs.
11. Human approval.
12. Test checklist.
13. Next action.

## Decision Rules

- Start with the smallest stable version that supports real operations.
- Add scalability only when the business need is clear.
- Prefer explicit status histories, audit logs, and idempotency keys over implicit state.
- Separate public Agency views from internal Admin views.
- Keep supplier communication as draft-first until approval.
- Keep AI/chatbot features read-only until the data boundary is proven.

## Required Risk Check

Before finalizing a plan, list:

- What is certain.
- What needs verification.
- What could break.
- What should be improved later.

## Claude Code Prompt Rule

When producing prompts for Claude Code, split work into independent phases:

- Inspect first.
- Identify risks.
- Implement one bounded slice.
- Test and verify.
- Summarize changed files.

Each prompt must say which files to inspect, which files to avoid changing, expected output, test commands, and the rule to avoid unrelated refactoring.

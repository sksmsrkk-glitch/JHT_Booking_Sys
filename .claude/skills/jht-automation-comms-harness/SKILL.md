---
name: jht-automation-comms-harness
description: Use for JHT automation workflows including operation reminders, supplier email/Kakao messages, supplier outbox workers, Gmail webhook matching, Notion CSV staging, retry queues, notification logs, idempotency, and human approval gates.
---

# JHT Automation and Communications Harness

Use this skill for automation, reminders, Gmail, supplier messages, and migration workflows.

## Required Reading

- `docs/system-blueprint.md` sections 4.10 through 4.14 and 8.
- `src/lib/domain/operations.mjs`
- `src/lib/domain/supplier-messages.mjs`
- `src/lib/domain/gmail-match.mjs`
- Related API routes under `src/app/api/automation`, `src/app/api/gmail`, `src/app/api/supplier-messages`, and `src/app/api/migrations`.

## Automation Harness

Every automation must define:

1. Purpose.
2. Trigger.
3. Input data.
4. Data source.
5. Processing steps.
6. Output destination.
7. Duplicate prevention.
8. Error handling.
9. Logs.
10. Retry policy.
11. Human approval point.
12. Test checklist.

Automations must be idempotent. Running the same workflow twice must not create duplicate reservations, messages, reminders, payments, passengers, or migration rows.

## Operation Reminder Rules

- Generate tasks after reservation confirmation.
- Skip tasks with `done` or `cancelled` status.
- Use stable idempotency key: `reservation_id + task_id + rule_id/code + reminder_date`.
- Escalate 48 hours, 24 hours, and overdue according to team rules.
- Log every reminder in `operation_reminder_logs`.
- Queue internal notifications instead of silently failing.

## Supplier Message Rules

Automation may create drafts. It must not send without approval.

Required flow:

1. Draft.
2. Review.
3. First approval.
4. Second approval for cancellation.
5. Queue.
6. Provider send.
7. Provider event log.
8. Retry or fallback.

Use `supplier_message_outbox.idempotency_key` to prevent duplicate send requests.

Record provider responses in `supplier_message_events`.

If Kakao fails for a business-critical supplier message, create or queue an email fallback.

## Gmail Matching Rules

- Reject duplicate `gmail_message_id`.
- Score by case code, thread id, agency email domain, tour name, and subject/body hints.
- Store confidence score and match reasons.
- Low confidence goes to manual review.
- Never auto-apply booking changes from Gmail without human approval.

## Notion CSV Migration Rules

- CSV goes to staging first.
- Target table must be allowlisted.
- Validate rows before import.
- Human approval is required before production insert.
- Keep agency and supplier import templates separate.
- Store migration errors row-by-row.

## External Integration Safety

- Gmail, Kakao, Google Maps, and email provider credentials must be server-side env vars.
- Provider calls should be retried with backoff.
- Provider failures should be visible in admin UI.
- Do not log secrets or PII in provider payload summaries.

## Verification

Test:

- Duplicate webhook message is ignored.
- Reminder runner does not duplicate daily reminders.
- Supplier cancellation cannot be queued without second approval.
- Kakao failure creates fallback path.
- Migration API rejects unsupported target tables.
- Automation endpoints reject missing/invalid secret headers.

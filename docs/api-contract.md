# API Contract

## Agency APIs

- `POST /api/agency/inquiries`
- `GET /api/agency/quote-cases/:shareId` (implemented by the shared `:id` route segment; this GET treats the value as `share_id`)
- `POST /api/agency/quote-cases/:id/revision-request`
- `POST /api/agency/quote-cases/:id/booking-request`
- `POST /api/agency/rooming-lists/upload`

## Internal APIs

- `GET /api/cost-items/search`
- `POST /api/quote-cases`
- `POST /api/quote-versions/:id/export-xlsx`
- `POST /api/reservations/:id/generate-operation-tasks`
- `PATCH /api/operation-tasks/:id`
- `POST /api/operation-tasks/:id/remind`
- `POST /api/supplier-messages/draft`
- `POST /api/supplier-messages/:id/approve`
- `POST /api/supplier-messages/:id/send`
- `POST /api/automation/reminders/run`
- `POST /api/gmail/webhook`
- `POST /api/migrations/notion-csv`

## Authorization Defaults

- Agency APIs use Supabase RLS through the caller's JWT.
- Internal APIs require an internal user role through RLS.
- Automation endpoints require `x-automation-secret`.
- High-risk actions require approval fields and audit logs.

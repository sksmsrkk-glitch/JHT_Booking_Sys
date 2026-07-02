# JHT V1 Launch Runbook

This runbook is for the handoff from local v1 build to real Supabase and domain setup.

Do not paste real secrets into this repository. Store production values only in the deployment platform and Supabase dashboard.

## 1. Preflight

Run the full local verification command before changing production environment values:

```bash
npm run verify:v1
```

This command must pass:

- `verify:env`
- `verify:schema` including RLS/policy coverage
- `verify:seed`
- API route guard audit
- API body-order audit
- API response audit
- API contract audit
- Repository safety scan
- Security config audit
- Launch runbook audit
- Page smoke coverage audit
- App route smoke coverage audit
- unit/domain/schema tests
- TypeScript typecheck
- production Next.js build
- runtime smoke check for all pages, API handler guards, logout cookie clearing, and baseline security headers

## 2. Supabase Project

Create or select the target Supabase project, then apply migrations in order:

```bash
supabase db push
```

If Supabase CLI is unavailable, apply the SQL files in this order through the Supabase SQL editor:

1. `supabase/migrations/202605100001_initial_schema.sql`
2. `supabase/migrations/202606260001_gmail_match_candidates.sql`
3. `supabase/migrations/202606270001_quote_excel_model.sql`
4. `supabase/migrations/202606270002_quote_fare_options.sql`
5. `supabase/migrations/202606270003_quote_presentation_blocks.sql`
6. `supabase/migrations/202606270004_supplier_media_attachments.sql`
7. `supabase/migrations/202606280001_partner_receivable_ledger.sql`
8. `supabase/migrations/202606280002_exchange_rates.sql`
9. `supabase/migrations/202606290001_agency_inquiry_tour_workflow.sql`
10. `supabase/migrations/202606290002_invoice_versioning.sql`
11. `supabase/migrations/202606290003_reservation_final_operation_invoice.sql`
12. `supabase/migrations/202606290004_guide_expense_reports.sql`
13. `supabase/migrations/202606300001_agency_onboarding_governance.sql`
14. `supabase/migrations/202606300002_country_reference_exchange_rates.sql`
15. `supabase/migrations/202606300003_workflow_portal_communication.sql`
16. `supabase/migrations/202607010001_workflow_message_actor_links.sql`
17. `supabase/migrations/202607020001_data_api_role_grants.sql`

After migration, open `/admin/readiness` with an internal admin account and confirm database smoke checks are ready.

Confirm the public health endpoint responds after deployment:

```text
GET /api/health
```

Confirm baseline security headers are present on the production domain:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` blocks camera, microphone, and geolocation

Confirm auth and JSON API responses include:

- `Cache-Control: no-store`

## 3. Seed Handling

`supabase/seed.sql` is local demo data only.

Use it for local or disposable staging verification. Do not load demo users, demo passwords, demo supplier rows, or demo agency rows into a real production project.

If a staging demo is needed, rotate or replace these rows before external users receive access:

- `demo-admin@junghotravel.local`
- `agency-user@worldtravellers.example`
- `JHT-2026-DEMO-001`
- `RSV-2026-DEMO-001`
- `INV-2026-DEMO-001`

For hosted Supabase projects, do not rely on raw SQL inserts into `auth.users` for login-ready demo accounts. Hosted Auth expects its own identity records and internal state. After migrations and optional demo business rows are loaded, create hosted demo Auth users with:

```bash
npm run seed:hosted-demo-auth
```

The script uses the server-side Supabase secret key from `.env.local`, creates real Auth users through the Supabase Admin API, then links them to `profiles`, `user_roles`, and `agency_users`.

Current local hosted-demo credentials:

- Internal admin: `jht-admin@junghotravel.local` / `JhtDemo!2026`
- Agency demo: `agency-demo@worldtravellers.example` / `AgencyDemo!2026`

Rotate or remove these demo accounts before any external or production use.

## 4. Environment Values

Copy `.env.example` into the deployment environment and fill values there, not in git.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOMATION_SECRET`
- `GMAIL_WEBHOOK_SECRET`
- `SUPPLIER_MESSAGE_WEBHOOK_SECRET`

Recommended before live supplier delivery:

- `SUPPLIER_MESSAGE_DELIVERY_MODE`
- `GOOGLE_MAPS_API_KEY`
- `EMAIL_PROVIDER_NAME`
- `EMAIL_PROVIDER_API_KEY`
- `KAKAO_BIZ_PROVIDER`
- `KAKAO_BIZ_API_KEY`
- `EXPORT_STORAGE_BUCKET`
- `SYSTEM_DEFAULT_CURRENCY`

Run this after changing env definitions:

```bash
npm run verify:env
```

## 5. Storage

Create the Supabase Storage bucket configured by `EXPORT_STORAGE_BUCKET`.
Create a supplier media bucket for item images before enabling direct file uploads.

Default bucket:

```text
exports
```

Confirm the quote export worker can write generated XLSX files and that internal users can retrieve completed exports through internal screens.
Confirm supplier item images can be uploaded or referenced and that each supplier item is limited to 10 images.

## 6. Bootstrap Admin

Set `INITIAL_ADMIN_BOOTSTRAP_SECRET` only for initial setup.

1. Create the first Supabase Auth user.
2. Open `/admin/bootstrap`.
3. Submit the bootstrap secret, auth user ID, email, and display name.
4. Confirm `/admin/users` shows the new admin/finance roles.
5. Remove or rotate `INITIAL_ADMIN_BOOTSTRAP_SECRET`.

## 7. Domain And Auth Redirects

Configure the production domain in the deployment platform.

In Supabase Auth settings, add the production site URL and any required redirect URLs for:

- `/auth/login`
- `/auth/logout`
- the production root domain
- any preview/staging domain used for QA

Confirm cookies are sent only over HTTPS in production.
The `jht_access_token` cookie is issued by `/auth/session` as an HttpOnly cookie with same-origin `Origin` validation, Max-Age aligned to the Supabase session expiry, and cleared by `/auth/logout`.

## 8. Webhooks

Register provider webhooks after production domain and secrets are ready.

Gmail webhook:

```text
POST /api/gmail/webhook
header: x-webhook-secret: GMAIL_WEBHOOK_SECRET
```

Supplier provider callback:

```text
POST /api/supplier-messages/provider-callback
header: x-webhook-secret: SUPPLIER_MESSAGE_WEBHOOK_SECRET
```

Confirm webhook failure/success traces appear in `/admin/audit/api-logs`.

## 9. Scheduled Workers

Schedule these internal automation endpoints with `x-automation-secret`:

```text
POST /api/automation/reminders/run
POST /api/automation/quote-exports/run
POST /api/automation/supplier-messages/run
```

Keep `SUPPLIER_MESSAGE_DELIVERY_MODE=dry_run` until provider credentials and callback behavior are verified.

## 10. Boundary QA

Before external agency users are invited, perform a real agency-user QA pass:

- Agency can create inquiries.
- Agency can see only sent/accepted quote versions.
- Agency cannot see supplier costs, `quote_items`, internal margins, internal totals, operation tasks, supplier messages, expenses, commissions, settlements, internal payment references, or passport numbers.
- Agency can upload rooming lists only for its own reservations.
- Agency invoices omit internal payment reference numbers.

Also confirm internal users can see the corresponding full operations data.

## 11. Final Acceptance

The v1 handoff is ready when all of these are true:

- `npm run verify:v1` passes after final code/env changes.
- `/api/health` returns `status: ok` on the production domain.
- Production responses include the baseline security headers.
- `/admin/readiness` shows required env as configured.
- Database smoke checks pass against the target Supabase project.
- Storage checks pass.
- First admin is bootstrapped and bootstrap secret is rotated.
- Webhooks are registered with current secrets.
- Scheduled workers run successfully.
- Failed jobs are visible in `/admin/automation/failed-jobs`.
- API traces are visible in `/admin/audit/api-logs`.
- Agency Portal boundary QA passes with a real agency user.

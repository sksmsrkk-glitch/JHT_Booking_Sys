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

With local Supabase running, also execute the database integrity regression suite:

```bash
npm run verify:integrity-local
```

This suite injects real RLS and failure scenarios for partner request atomicity, revision status updates,
invoice-scoped payment idempotency, finance KPI aggregation beyond 100 rows, privileged RPC access,
and supplier-message requeue safety. It runs inside a transaction and rolls back all verification data.

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
18. `supabase/migrations/202607030001_security_hardening.sql`
19. `supabase/migrations/202607040001_quote_version_internals.sql`
20. `supabase/migrations/202607070001_signup_application_billing_currency.sql`
21. `supabase/migrations/202607130001_partner_auth_lifecycle.sql`
22. `supabase/migrations/202607130002_canonical_workflow_code.sql`
23. `supabase/migrations/202607130003_account_recovery.sql`
24. `supabase/migrations/202607150001_scalability_query_indexes.sql`
25. `supabase/migrations/202607150002_reservation_readiness_dashboard.sql`
26. `supabase/migrations/202607150003_atomic_writes_idempotency.sql`
27. `supabase/migrations/202607150004_atomic_partner_inquiry.sql`
28. `supabase/migrations/202607150005_hybrid_worker_contract.sql`
29. `supabase/migrations/202607150006_worker_atomic_finish_audit.sql`
30. `supabase/migrations/202607150007_restore_privileged_session_helper.sql`
31. `supabase/migrations/202607150008_repair_signup_billing_currency.sql`
32. `supabase/migrations/202607180001_partner_request_payment_security.sql`
33. `supabase/migrations/202607180002_admin_finance_kpis.sql`
34. `supabase/migrations/202607180003_supplier_message_delivery_safety.sql`
35. `supabase/migrations/202607180004_quote_revision_lifecycle.sql`
36. `supabase/migrations/202607180005_admin_dashboard_analytics.sql`
37. `supabase/migrations/202607190001_remove_legacy_admin_finance_kpis.sql`

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
- workflow code: `MY-WORLDTRAVE-20260627-A1B2C3`
- invoice version: `MY-WORLDTRAVE-20260627-A1B2C3-INV-V01`

For hosted Supabase projects, do not rely on raw SQL inserts into `auth.users` for login-ready demo accounts. Hosted Auth expects its own identity records and internal state. After migrations and optional demo business rows are loaded, create hosted demo Auth users with:

```bash
npm run seed:hosted-demo-auth
```

The script uses the server-side Supabase secret key from `.env.local`, creates real Auth users through the Supabase Admin API, then links them to `profiles`, `user_roles`, and `agency_users`.

Set `DEMO_ADMIN_PASSWORD` and `DEMO_AGENCY_PASSWORD` only in the local environment before running the hosted demo seed.
Never commit those values, and remove the demo accounts before external or production use.

## 4. Environment Values

Copy `.env.example` into the deployment environment and fill values there, not in git.

Security and development-only options include `API_MAX_JSON_BYTES`, `SIGNUP_RATE_LIMIT_SECRET`, `JHT_DEMO_MODE`,
`ACCOUNT_RECOVERY_RATE_LIMIT_SECRET`, `DEMO_ADMIN_PASSWORD`, and `DEMO_AGENCY_PASSWORD`. Keep demo mode and demo passwords unset in production.
Set `SUPPLIER_MEDIA_STORAGE_BUCKET=supplier-media` and create that private Storage bucket before uploading supplier images.

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
- `POST /auth/logout`
- the production root domain
- any preview/staging domain used for QA

Confirm cookies are sent only over HTTPS in production.
`/auth/session` verifies the access-token signature, expiry, and configured Supabase project before issuing separate `jht_access_token` and `jht_refresh_token` HttpOnly cookies after same-origin `Origin` validation. The access-cookie Max-Age follows the Supabase session expiry, middleware rejects malformed or foreign-project tokens and rotates stale sessions through Supabase Auth, and `POST /auth/logout` clears both cookies without exposing a prefetchable GET side effect.

After deploying this session upgrade, users holding an older access-only cookie must log out once and log in again so the browser receives the refresh-token cookie. Verify that an authenticated click into `/admin/...` or `/agency/...` remains on the selected page after the access token is refreshed.

As an authentication regression check, verify all three outcomes: a request without cookies redirects to the matching login page, an invalid token is rejected by `POST /auth/session` without `Set-Cookie`, and a verified internal or partner session loads protected pages without an `Authentication is required` or `role required` banner.

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

## 12. Scalability And Worker Acceptance

프로덕션 배포 전 다음 확장성 항목을 추가 확인한다.

1. `202607150001`부터 `202607150007`까지의 migration이 대상 Supabase에 적용되었는지 확인한다.
2. `npx supabase db lint --linked` 또는 안전한 staging local lint를 통과시킨다.
3. staging에서 `npm run test:e2e`를 데스크톱과 모바일 프로젝트 모두 실행한다.
4. 테스트 JWT로 `npm run smoke:load`를 실행하고 인증 API p95가 750ms 이하인지 확인한다.
5. 동일 `idempotency-key`로 문의, CSV staging, 인보이스 요청을 재시도했을 때 동일 ID가 반환되는지 확인한다.
6. quote export worker 두 개를 동시에 실행했을 때 같은 job ID를 claim하지 않는지 확인한다.
7. worker가 강제 종료된 경우 lease 만료 후 job이 다시 claim되는지 확인한다.
8. 운영 secret에 `API_SLOW_REQUEST_MS`, `AUTOMATION_SECRET`, Storage credential이 설정되었는지 확인한다.

Java worker는 `docs/java-hybrid-decision.md`의 트리거를 충족하고 staging canary 비교가 끝나기 전에는 배포하지 않는다.

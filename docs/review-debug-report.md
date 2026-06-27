# Code Review And Debug Report

Review date: 2026-06-27

## Scope

This review covered the current V1 implementation surface:

- Internal Admin and Overseas Agency Portal.
- API guard, response, and runtime smoke coverage.
- Session cookie flow.
- Agency versus Domestic Supplier data boundary.
- Automation, finance, supplier message, audit, and launch readiness checks.

## Finding Fixed

### 1. Internal server messages could be exposed in API 5xx responses

Severity: High

The shared `fail()` helper returned `error.message` for `HttpError` and generic `Error` responses, including `500` status errors. Many API routes pass Supabase error messages into `HttpError(500, error.message)`. That means database, RLS, provider, or environment detail could be returned to callers.

Fix:

- `src/lib/api/http.ts` now masks all `HttpError` messages with status `>= 500`.
- Generic `Error` instances now return `Internal server error`.
- 4xx business and validation messages remain visible.
- `Cache-Control: no-store` remains enforced after caller headers are merged.

Regression guard:

- `tests/schema-boundary.test.mjs` now checks that the API helper contains the 5xx masking rule and does not directly expose `error.message` for 500 responses.

## Review Notes

### Agency and supplier boundary

Status: Passed current automated checks.

Evidence:

- RLS/policy checks cover all created tables.
- Agency Portal query tests block references to supplier prices, quote item internals, supplier outbox, settlements, expenses, commissions, internal payment references, and passport numbers.
- Runtime smoke checks Agency pages separately from internal pages.

### API protection

Status: Passed current automated checks.

Evidence:

- 69 API route files and 78 handlers are covered by guard verification.
- `/api/health` is the only public allowlisted API.
- Request body parsing is verified to happen after auth/shared-secret checks.
- API contract verification confirms every implemented handler is documented.

### Session and cache safety

Status: Passed current automated checks.

Evidence:

- Login creates the cookie through `/auth/session`; no direct `document.cookie` login write.
- Session route validates Origin.
- Session and logout responses use no-store.
- API JSON responses use shared no-store helpers.
- Runtime smoke validates session cookie `HttpOnly`, `Secure`, `SameSite=lax`, `Max-Age`, invalid Origin rejection, and no-store headers.

### Launch readiness

Status: Passed current automated checks.

Evidence:

- Launch runbook aligns with readiness env definitions, storage checks, and migration files.
- Repository safety scan passes.
- Production build and runtime smoke pass.

## Commands Run

```bash
git pull --ff-only
npm run test
npm run typecheck
npm run verify:v1
```

Result: all commands passed. `verify:v1` passed environment, schema, seed, API guard, API body-order, API response, API contract, repository safety, security config, launch runbook, page smoke, app route smoke, tests, typecheck, production build, and runtime smoke.

## Residual Risks

- Real Supabase project setup, Auth redirect configuration, Storage bucket permissions, provider credentials, Gmail webhook registration, and production domain behavior still require environment-level validation.
- Supplier message live delivery should remain dry-run until provider account credentials, callback signing, approval operations, and fallback handling are tested with real provider sandboxes.
- Local demo seed credentials must not be loaded into production.

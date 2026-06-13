# JHT Operations Platform

This repository implements the foundation for Jungho Travel's inbound travel operations system.

The core domain rule is strict terminology separation:

- `Overseas Agency`: the foreign travel agency customer that requests quotes, sells locally, sends passengers, and pays JHT.
- `Domestic Supplier`: the Korea-side supplier that provides hotel rooms, coaches, restaurants, guides, attractions, and other cost items.

Do not model both concepts as a generic `partner`. Their permissions, accounting flow, communication flow, and data visibility are different.

## Implemented Foundation

- Next.js App Router scaffold for internal admin and overseas agency portal.
- Supabase SQL migration with separated `agency_*` and `domestic_supplier_*` tables.
- Quote, reservation, operation reminder, supplier communication, finance, migration, Gmail, and audit tables.
- RLS policies that prevent overseas agencies from reading domestic supplier costs or internal finance data.
- API route skeletons for the planned workflows.
- Domain tests for margin calculation, reminder idempotency, supplier message approval rules, and Gmail matching.

## Design Documents

- [System Blueprint](docs/system-blueprint.md): full system definition, feature specification, ERD, workflows, directory structure, security, and implementation phases.
- [Architecture Plan](docs/architecture.md): short architecture summary.
- [API Contract](docs/api-contract.md): current API route contract.
- [Claude Code Prompt Set](docs/claude-code-prompt-set.md): phased prompts for controlled implementation.
- [Claude Harness Benchmark Sources](docs/claude-harness-benchmark-sources.md): benchmarked Claude Code repositories and patterns used for this project's `CLAUDE.md` and skills.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase setup:

```bash
supabase start
supabase db reset
```

Verification:

```bash
npm run test
npm run typecheck
npm run build
```

## Safety Rules

- Quote items store snapshots of supplier cost, exchange rate, product names, and margin at the time of quote creation.
- Reservation confirmation, cancellation, supplier change/cancel messages, invoice issuance, payment handling, and settlement approval are high-risk actions.
- High-risk actions must write `audit_logs` and require approval before execution.
- Supplier messages are drafted first. Email/Kakao send is blocked until approved.

# Architecture Plan

## Objective

Build a `Next.js + Supabase` operating system for Jungho Travel's inbound business:

- Costing DB
- Automated quotation
- Overseas agency portal
- Reservation operations
- Domestic supplier email/Kakao communication
- Operation task reminders
- Finance and settlement
- Gmail and Notion CSV migration

## Business Entity Boundary

| Concept | System Name | Meaning |
|---|---|---|
| Foreign travel agency customer | `Overseas Agency` | Requests quotes, sells travel products locally, sends passengers, pays tour fees |
| Korea-side content supplier | `Domestic Supplier` | Provides hotel rooms, coaches, restaurants, attractions, guide services, and cost data |

This is a hard boundary. Never use a generic `partner` table for both.

## Modules

- `agency`: overseas travel agency accounts and users.
- `supplier`: Korean domestic suppliers, products, prices, media.
- `costing`: cost search and cost item snapshots.
- `quotation`: quote cases, versions, itinerary days, Excel exports.
- `reservation`: confirmed bookings, rooming lists, status history.
- `operations`: task generation, dependency tracking, reminders.
- `supplier_comms`: supplier message templates, outbox, email/Kakao events.
- `finance`: invoices, payments, expenses, shopping commissions, settlements.
- `automation`: Gmail webhook, reminder runner, CSV migration.
- `audit`: high-risk action log and API logs.

## V1 Release Surface

1. Foundation: schema, RLS, audit, terminology, login/session, readiness, bootstrap, and internal/agency workspaces.
2. Master Data: companies, internal users, Overseas Agencies, Domestic Suppliers, contacts, products, prices, and Notion CSV staging.
3. Quotation: quote cases, versions, immutable cost snapshots, margins, itinerary days, route segments, status lifecycle, and agency-safe quote views.
4. Agency Portal: inquiry creation, quote review, revision request, booking request, reservation view, rooming list upload, and invoice view.
5. Operations: reservations, status history, default task generation, task board, reminders, passengers, room assignments, and locked controls for cancelled/completed reservations.
6. Supplier Comms: reservation/supplier-aware drafts, approval, send queue, provider callbacks, event logs, and supplier contact validation.
7. Finance and Automation: invoices, payments, expenses, extra revenues, shopping commissions, settlement recalculation/approval/close, closed-state locks, Gmail review, and audit visibility.

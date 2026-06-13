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

## Release Path

1. Foundation: schema, RLS, audit, terminology, internal/agency shells.
2. Master Data: domestic supplier products, pricing, media, Notion CSV staging.
3. Quotation: quote builder, margin, route, export.
4. Agency Portal: inquiry, quote view, revision, booking request, rooming list.
5. Operations: reservations, task generation, reminders.
6. Supplier Comms: draft, approval, email/Kakao outbox.
7. Finance and Automation: invoices, payments, settlement, Gmail sync.

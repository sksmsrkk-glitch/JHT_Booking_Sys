---
name: jht-quote-reservation-domain
description: Use for JHT quotation, cost snapshot, margin calculation, itinerary, route segment, Excel export, reservation lifecycle, rooming list, passenger, room assignment, and quote-to-booking business logic.
---

# JHT Quote and Reservation Domain

Use this skill when changing quote, booking, reservation, rooming list, or Excel export behavior.

## Required Reading

- `docs/system-blueprint.md` sections 4.4 through 4.9.
- `src/lib/domain/quotation.mjs`
- `tests/domain.test.mjs`
- Current quote/reservation tables in `supabase/migrations/202605100001_initial_schema.sql`.

## Quote Snapshot Rule

Quote items must store immutable snapshots:

- Source supplier product ID.
- Source supplier price ID.
- Item name.
- Supplier name.
- Cost currency.
- Unit cost amount.
- Exchange rate to KRW.
- Pricing unit.
- Quantity.
- Pax count.
- Margin mode.
- Margin rate or manual amount.
- Total cost.
- Total sell amount.
- Public/internal notes.

Supplier price changes must not mutate old quote items. Use a new quote version.

## Margin Rules

Support:

- Automatic margin rate.
- Manual margin amount.
- Manual total sell amount.
- Positive margin.
- Negative margin when business-approved.

Never compute final business totals only in the browser. Server/domain logic must own calculations.

## Quote Version Rules

- One quote case can have many versions.
- Agency-visible data must be stored separately from internal cost detail.
- Agency can only see sent/accepted/superseded versions.
- Quote item internals remain internal-only.
- Excel export must use DB snapshot values, not spreadsheet formulas as source of truth.

## Reservation Rules

When quote becomes reservation:

1. Use accepted quote version.
2. Create reservation with unique reservation code.
3. Write status history.
4. Generate operation tasks.
5. Generate supplier message drafts, not sends.

Reservation status changes must write `reservation_status_history`.

## Rooming List Rules

- Store every upload as a `rooming_lists` revision.
- Use idempotency key or `(reservation_id, revision_no)` to prevent duplicates.
- Use `(reservation_id, passenger_no)` to prevent duplicate passengers.
- Treat passport number, date of birth, dietary requirements, and rooming file content as PII.
- Re-upload should create a new revision unless explicitly replacing a failed parse.

## Route Rules

- Store route segments by itinerary day.
- Use Google Maps Directions as the primary provider.
- Keep Naver Map URL only as legacy reference.
- Manual overrides must be marked.
- Agency may see public route summaries only for public quote versions.

## Verification

Run or add tests for:

- Positive and negative margin.
- Manual amount/total margin.
- Snapshot immutability.
- Reservation creation status history.
- Operation task generation after confirmation.
- Rooming list duplicate prevention.
- Agency quote view cost/margin non-exposure.

# Overseas Agency Portal Workflow

## Development Preview Rule

During product design and local testing, agency login can be bypassed for partner portal screens. Preview submissions return a generated tour code but do not write a database row unless a valid agency JWT is present.

Production must restore agency-scoped RLS behavior before launch.

## Inquiry Types

### New Inquiry

Required fields:

- Tour title / group name / company name
- Number of pax
- Period
- Nights in Korea

Optional fields:

- Arrival date
- Departure date
- Preferred language
- Tour type
- Arrival and departure flight details
- Free-text itinerary / program request

Each new inquiry generates a `tour_code` using:

`COUNTRY-AGENCY-YYYYMMDD`

Example: `MY-WORLDTRAV-20260629`

The tour code is the lifecycle key for quote, revision, booking confirmation, reservation operation, invoice versions, collection status, and accounting follow-up.

### Revision / Change Inquiry

Revision and change requests should reference the existing tour code. Common changes include:

- Hotel change
- Restaurant / menu change
- Attraction or program change
- Nights change, for example 4 nights to 5 nights
- Date change, for example August 10 to September 10
- Pax change

The request payload keeps the partner's free-text request so JHT staff can compare it against the last sent quote.

### Cancellation Inquiry

Cancellation requests should reference the tour code and capture a cancellation reason. The cancellation request should remain attached to the quote/reservation timeline.

## Inquiry Data Model

`agency_inquiries` has dedicated workflow fields:

- `tour_code`
- `arrival_date`
- `departure_date`
- `period_text`
- `nights_count`
- `flight_details`

Long-form content remains in `request_payload`:

- `itineraryText`
- `changeSummary`
- `cancellationReason`
- `relatedTourCode`
- `notes`

## Reservation Portal

The partner must be able to review all confirmed reservations owned by their agency. Each reservation should open a detail page that shows:

- Quote/tour code
- Accepted quote summary
- Revision, change, booking, and cancellation requests
- JHT replies and status history
- Rooming list upload status
- Partner-safe invoice status

## Invoice Structure From Reference Workbook

Reference file analyzed:

`2025.03- invoice for 24 mar x 26 paxs - World Travellsers (mhdm).xlsx`

Observed invoice layout:

- Header: JHT company name, address, phone, fax, email
- Title: `AGENT TOUR INVOICE`
- Invoice date
- Invoice number
- Attention
- Travel agent
- Group name
- Group size with adult/child/TL split
- Itinerary section with day/date/city/program/meals
- Unit section with currency, item description, unit amount, quantity, and unit label
- Total amount in words, for example `TOTAL IN MYR`
- Payment deadline
- Bank account / payable information
- Remarks and flight details

Observed workbook pattern:

- Multiple sheets can represent group splits or invoice versions, such as `GRP1`, `GRP2`, `GRP3`, `CREW1,2`, `CREW3`.
- Invoice line items are auditable rows: description + currency + unit price + multiplier/quantity + unit label.
- Flight details can contain multiple arrival/departure or pickup-related rows.

## Invoice Versioning Requirement

Invoices must be versioned by tour code:

- Initial invoice
- Revised invoice after quote/reservation changes
- Final confirmed invoice

Each invoice version should keep:

- `tour_code`
- `invoice_no`
- `version_no`
- `reservation_id`
- `currency`
- `line_items`
- `itinerary_snapshot`
- `flight_details`
- `bank_account_snapshot`
- `payment_deadline`
- `deposit_required`
- `deposit_amount`
- `collection_timing`: deposit, after booking confirmation, before tour, or after tour
- `collection_status`: unpaid, deposit_received, partially_paid, paid, overdue

Finance dashboard should use this state to show receivables and payment follow-up by tour code, partner, country, month, and staff owner.

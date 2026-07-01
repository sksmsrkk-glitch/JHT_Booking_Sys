# Reservation Group Status Board

This document records the analysis of JHT's current `2026. 단체현황(원본) - 2025년.csv`
file and the implementation direction for the Reservations workspace.

## Source Sheet Pattern

The exported CSV is not a normal database-style table with one header row per field.
It is a monthly operation calendar:

- Row 1 is the date axis. The first cell is the month, then each following cell is a day.
- Each group occupies multiple adjacent rows rather than one row.
- The first group row usually contains the arrival flight and the group title.
- The next group row usually contains arrival time, hotel or region per stay date, and departure flight.
- Extra rows can contain internal operation notes such as `F&E`, `KTX짐차`, `룸쇼`, `미팅온리`,
  hotel meeting notes, room extensions, cancellations, and special transport notes.
- Group titles commonly include agency name, pax composition, room composition, guide name,
  and phone number in a compact free-text form.

Example source patterns observed:

| Pattern | Meaning |
| --- | --- |
| `SQ612` / `SQ601 1645` | Arrival and departure flight cells. |
| `FIT: Azza Travel (3a) 1trp ...` | Group title, agency, pax, room or trip count, guide/contact notes. |
| `글로스터`, `라마다해운대`, `솔라고` | Hotel or daily location cells across the date axis. |
| `F&E`, `KTX짐차`, `룸쇼` | Daily operation memo cells. |
| `(14a+1tl)=15`, `(16a+1c+1inf+1tl)=19` | Pax composition and computed total pax. |

## Reservation Screen Mapping

The `/admin/reservations` page now uses the spreadsheet model as its first-screen layout:

| Sheet Concept | Current System Field |
| --- | --- |
| Group code | `reservations.reservation_code` |
| Group title | `quote_cases.tour_name` |
| Agency | `agency_accounts.name` |
| Pax | `quote_cases.estimated_pax`, with a fallback parser for title text such as `(14a+1tl)=15` |
| Date axis | `reservations.tour_start_date` to `reservations.tour_end_date` |
| Arrival cell | First date in reservation range |
| Stay cells | Dates between arrival and departure |
| Departure cell | Last date in reservation range |
| Rooming status | `rooming_lists` revision count |
| Hotel, vehicle, guide, content, finance progress | `operation_tasks` grouped by team |

The UI keeps direct reservation actions so staff can still generate operation tasks and open detail pages.

## Required DB Extension For Full Migration

The current schema already covers reservation lifecycle, rooming lists, passengers, room assignments,
operation tasks, supplier messages, invoices, and settlements. To fully absorb the legacy group
status sheet, the next migration should add a dedicated operation profile layer instead of forcing
all free-text cells into `reservations`.

Recommended tables:

### `reservation_operation_profiles`

One row per reservation for sheet-level status fields.

| Column | Purpose |
| --- | --- |
| `reservation_id` | Reservation foreign key, unique. |
| `arrival_flight_no`, `arrival_time` | Arrival flight information from the first status row. |
| `departure_flight_no`, `departure_time` | Departure flight information from the final status cell. |
| `lead_guide_name`, `lead_guide_phone` | Main guide parsed from group title or manually entered. |
| `vehicle_summary` | Coach/van/transport notes. |
| `hotel_summary` | Main hotel summary when daily detail is not yet normalized. |
| `room_summary` | Room composition such as twin/single/triple/suite notes. |
| `internal_operation_memo` | Staff-only memo migrated from free-text cells. |
| `source_sheet_payload` | Original parsed row/cell payload for audit and reimport safety. |

### `reservation_daily_operations`

One row per reservation per service date.

| Column | Purpose |
| --- | --- |
| `reservation_id` | Reservation foreign key. |
| `service_date` | Calendar date. |
| `day_no` | Day number inside the tour. |
| `hotel_name` | Hotel or stay label from the date cell. |
| `region_label` | Seoul, Busan, Jeju, Gangwon, or custom label. |
| `vehicle_note` | Daily transport note such as KTX/luggage truck. |
| `guide_note` | Daily guide or meeting note. |
| `operation_note` | Free-text daily memo such as F&E, room show, meeting only. |
| `quote_itinerary_day_id` | Optional link to detailed quote itinerary day. |

This lets the system keep the familiar spreadsheet view while also supporting clean supplier bookings,
daily itinerary descriptions, hotel image blocks, vehicle assignments, rooming, and finance workflows.

## CSV Import Strategy

Because the source CSV is calendar-shaped, import should not use `Import-Csv` style header mapping.
The parser should:

1. Detect month header rows.
2. Build an absolute date axis for each month section.
3. Detect group start rows using flight-like cells, group title cells, and pax patterns.
4. Attach following rows as hotel/daily memo rows until the next group start row.
5. Preserve the original cell coordinates in `source_sheet_payload`.
6. Let staff review parsed rows before writing to Reservations.

This review-first approach is important because the legacy sheet intentionally uses compact human
notation that can contain multiple meanings in one cell.

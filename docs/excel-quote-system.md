# Excel-Style Quote System Notes

Last updated: 2026-06-27

## Attachment Analysis Status

The requested reference workbooks under `C:\Users\Issac\OneDrive\바탕 화면` became readable on the second pass. Raw workbook structure, formula, keyword, and important-row extraction was saved to `docs/excel-analysis-raw.json` for implementation follow-up.

The analyzed files show a consistent workbook pattern:

- `costing` or hotel-named sheets act as the internal calculation ledger.
- `quotation` sheets act as the customer-facing quote.
- Customer quote sheets reference costing sheets heavily.
- Common public fields include attention/contact, date, tour title, group size, proposed hotel, tour fare, single supplement, inclusions, exclusions, conditions, day-by-day itinerary, meals, entrance fees, and hotel/option alternatives.
- Common formula patterns include `=sourceCell/sourceCell`, `=(SUM(range))*cell`, direct cross-sheet references, `TEXT(date,"dddd")`, and copied public quotation references from costing rows.

## Required Behavior

The admin quote builder must behave like the existing Excel quote sheets:

- A new quote request creates a new JHT quote/tour code.
- A revision or re-quote must stay attached to the existing quote/tour code.
- Admin users must see previous quote versions, agency request messages, booking requests, and revision requests in one quote detail screen.
- Quote versions must copy previous itinerary rows, route segments, and quote item snapshots so a re-quote starts from the last working version.
- Each quote item must support both database-loaded cost values and manual spreadsheet-style overrides.
- Each quote item must preserve the calculation context needed to audit a number later, even if the number came from an Excel-like manual model.

## Implemented V1 Model Extension

`quote_items` now supports these additional fields:

| Field | Purpose |
|---|---|
| `service_section` | Groups rows like hotel, vehicle, guide, meal, admission, land, optional, or other. |
| `calculation_mode` | Records whether the row came from automatic formula, manual unit entry, manual total, or override. |
| `excel_cell_ref` | Stores the source cell reference or workbook address such as `B24` or `Quotation!H42`. |
| `excel_formula` | Stores the copied Excel formula or plain-language calculation note. |
| `manual_override` | Flags rows where the calculated amount was intentionally overridden. |
| `supplier_cost_breakdown` | JSON object for internal cost components such as rooms, nights, FOC, single supplement, child/adult counts, guide days, vehicle days, or ticket counts. |
| `public_breakdown` | JSON object for agency-safe display details. |

These fields are internal by default. Agency Portal still reads only safe quote version summaries, itinerary rows, public totals, and request history.

`quote_versions` now also supports customer-facing quotation-sheet data:

| Field | Purpose |
|---|---|
| `public_fare_options` | Array of hotel/option alternatives, such as proposed hotel, tour fare, single supplement, currency, and customer-safe notes. |
| `excel_source_summary` | Internal audit object for workbook file name, sheet name, reference rows, copied formulas, or extraction notes. |

Partner-facing quote presentation is handled by `quote_presentation_blocks`:

| Field | Purpose |
|---|---|
| `block_type` | Image, hotel, menu, attraction, description, or similar block type. |
| `display_context` | Cover, itinerary, hotel, meal, attraction, terms, or another presentation section. |
| `quote_itinerary_day_id` | Optional day-level placement for itinerary descriptions and day-specific images. |
| `image_storage_path` / `image_url` | Supabase Storage path or external/public image URL. |
| `title`, `description`, `alt_text` | Customer-facing copy for the quote sheet. |
| `is_public` | Controls whether Agency Portal may read the block. |

## Admin Quote Detail Changes

The quote detail screen now includes:

- Tour code request thread for new, revision, and booking inquiries tied to the quote case.
- Excel reference and calculation mode columns in the quote item table.
- Service section and formula/calculation-note display.
- Supplier-cost breakdown JSON preview for internal audit.
- Quote item creation inputs for service section, itinerary day, calculation mode, Excel cell reference, formula note, manual override, supplier-cost breakdown JSON, and public breakdown JSON.

## Agency Portal Changes

The agency quote detail screen now includes a customer-safe request thread:

- Request created time.
- Request type.
- Status.
- Title.
- Message/reference summary.

Supplier costs, quote item internals, margins, internal totals, operation tasks, supplier messages, expenses, commissions, settlements, internal payment references, and passport numbers remain hidden.

## Follow-Up Workbook Extraction Checklist

After the attached workbooks are locally readable:

1. Extract sheet names, used ranges, merged cells, formulas, visible labels, and repeated row sections.
2. Classify rows into service sections.
3. Map Excel input cells to `supplier_cost_breakdown` keys.
4. Map calculated cells to `excel_formula` or system formula fields.
5. Identify public-facing rows versus internal-only rows.
6. Add import templates or helper actions if the workbooks have stable section layouts.

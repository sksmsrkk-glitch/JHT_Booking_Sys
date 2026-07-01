# Accounting Receivables Dashboard

This note captures the design derived from `자금일보_2026년 - 미수현황.csv` and how it connects to confirmed reservation finance.

## CSV Structure

The current cash daily report is partner-ledger data, not reservation-level data.

Observed columns:

- `국가`: country/currency bucket, for example `필리핀(USD)`, `싱가포르(SGD)`, `기타(KRW)`
- `거래처`: overseas agency or OTA partner name
- `통화`: `KRW`, `USD`, `SGD`
- `전기이월금액`: brought-forward balance
- `입금액`: received payment amount
- `미수금`: outstanding receivable
- `총투어비`: total tour sales
- `투어비_26.01` through `투어비_26.12`: monthly tour sales buckets

Sample analysis from the provided file:

- 129 partner rows
- 7 KRW rows, 89 USD rows, 33 SGD rows
- Largest KRW receivable observed: `KKDay`, KRW `45,155,550`
- Large foreign-currency receivable buckets appear under the Philippines and Singapore partner groups

Parenthesized values such as `(13,124.00)` must be parsed as negative accounting numbers.

## Current System Link

Confirmed groups are represented by `reservations`.

Finance data already links to confirmed groups through:

- `invoices.reservation_id`
- `payments.invoice_id`
- `settlements.reservation_id`

The dashboard now computes:

- settlement completed count: `settlements.status in ('approved', 'closed')`
- receivable count: invoices with `total_amount - confirmed_payment_total > 0`
- receivable amount: `invoices.total_amount - confirmed payments`

This means the operational dashboard can show finance status per country, partner, period, and status without exposing supplier costs.

## Recommended Import Model

Add a partner ledger import layer before writing to reservation finance tables.

Recommended table:

```sql
partner_receivable_ledger (
  id uuid primary key,
  agency_account_id uuid references agency_accounts(id),
  source_file_name text not null,
  source_year int not null,
  country_bucket text,
  partner_name text not null,
  currency text not null,
  carry_forward_amount numeric(14,2) not null default 0,
  payment_amount numeric(14,2) not null default 0,
  outstanding_amount numeric(14,2) not null default 0,
  total_tour_amount numeric(14,2) not null default 0,
  monthly_tour_amounts jsonb not null default '{}'::jsonb,
  match_status text not null default 'unmatched',
  created_at timestamptz not null default now()
)
```

Recommended match rules:

1. Match `거래처` to `agency_accounts.name`.
2. Use `통화` as billing currency validation.
3. Use `국가` to suggest or validate `agency_accounts.country_code`.
4. Match monthly tour amounts to reservations by partner and tour month where possible.
5. Keep unmatched ledger rows visible in Finance dashboard for manual review.

## Dashboard Behavior

The Internal Admin dashboard should show two finance layers:

- Reservation-level live finance: invoices, payments, settlements
- Partner-ledger finance: imported cash daily report rows

Until the import table is implemented, dashboard receivables are calculated from live invoice/payment data.

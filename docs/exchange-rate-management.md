# Exchange Rate Management

JHT uses a central exchange-rate master so quotation, supplier cost snapshots, invoices, and settlement review can share the same reference rates.

Rates can be global or country-specific. A USD/KRW rate for Thailand, Malaysia, Singapore, or a partner market can be maintained separately when the quotation needs a different commercial rate by country.

## Core Rule

Exchange rates are centrally maintained in `exchange_rates`, but quote and finance records store the applied rate as a snapshot.

This preserves the rate used at the time of quotation or settlement review. Updating today's common exchange rate must not silently recalculate already-sent quotes.

## Data Model

`exchange_rates` stores:

- `country_code`: optional market code, for example `TH`, `MY`, `SG`; empty means global default
- `country_name`: optional display name for the market
- `base_currency`: source currency, for example `USD`, `SGD`
- `quote_currency`: target currency, normally `KRW`
- `rate`: conversion rate from base currency to quote currency
- `effective_date`: date the rate starts applying
- `source`: manual, bank, accounting, or other source label
- `status`: active, inactive, archived

The latest active row by `country_code`, `base_currency`, `quote_currency`, and `effective_date` is used by forms. If a country-specific rate is requested but no active row exists, the API falls back to the global rate for the same currency pair.

`quote_exchange_rate_snapshots` stores the rate set selected on each quote version:

- `quote_version_id`: quote version that owns the snapshot
- `country_code` and `country_name`: the quotation market
- `base_currency`, `quote_currency`, `rate`, and `effective_date`: the applied rate data
- `source_exchange_rate_id`: optional link to the common exchange-rate row
- `source` and `notes`: manual or imported source context

## Connected Screens

- `/admin/exchange-rates`: create and review common rates
- `/admin/quote-cases`: add one or more quote-level country FX rows, load common FX, and save them as quote-version snapshots
- quote case detail item creation: selected supplier cost currency can load latest common FX with an optional country code
- quote item costing: item-level FX still saves the applied number on the quote item so historical quotations remain stable

## Future Import

When accounting uploads daily or monthly FX sheets, import rows into `exchange_rates` instead of overwriting older values.

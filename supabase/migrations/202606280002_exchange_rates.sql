create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  country_code text,
  country_name text,
  base_currency text not null,
  quote_currency text not null default 'KRW',
  rate numeric(18,6) not null check (rate > 0),
  effective_date date not null default current_date,
  source text,
  notes text,
  status text not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('active', 'inactive', 'archived')),
  unique (country_code, base_currency, quote_currency, effective_date, source)
);

create index if not exists exchange_rates_lookup_idx
  on exchange_rates(country_code, base_currency, quote_currency, status, effective_date desc);

create table if not exists quote_exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id) on delete cascade,
  country_code text,
  country_name text,
  base_currency text not null,
  quote_currency text not null default 'KRW',
  rate numeric(18,6) not null check (rate > 0),
  effective_date date,
  source_exchange_rate_id uuid references exchange_rates(id),
  source text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists quote_exchange_rate_snapshots_version_idx
  on quote_exchange_rate_snapshots(quote_version_id, country_code, base_currency, quote_currency);

alter table exchange_rates enable row level security;
alter table quote_exchange_rate_snapshots enable row level security;

drop policy if exists "exchange rates internal all" on exchange_rates;
create policy "exchange rates internal all"
  on exchange_rates
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "quote exchange snapshots internal all" on quote_exchange_rate_snapshots;
create policy "quote exchange snapshots internal all"
  on quote_exchange_rate_snapshots
  for all
  using (has_internal_role())
  with check (has_internal_role());

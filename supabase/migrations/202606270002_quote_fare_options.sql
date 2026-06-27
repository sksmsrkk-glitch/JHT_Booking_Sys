alter table quote_versions
  add column if not exists public_fare_options jsonb not null default '[]'::jsonb,
  add column if not exists excel_source_summary jsonb not null default '{}'::jsonb;

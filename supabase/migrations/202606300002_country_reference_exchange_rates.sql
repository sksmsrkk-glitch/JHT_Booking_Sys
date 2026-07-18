-- @file 한글 책임: Supabase 마이그레이션 `country reference exchange rates`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

create table if not exists country_references (
  country_code text primary key,
  country_name text not null,
  default_currency text,
  aliases jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  status text not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country_code = upper(country_code)),
  check (status in ('active', 'inactive', 'archived'))
);

create index if not exists country_references_name_idx
  on country_references(lower(country_name), status);

alter table agency_signup_applications
  add column if not exists original_country_name text;

insert into country_references (country_code, country_name, default_currency, aliases, source)
select distinct
  upper(country_code),
  coalesce(nullif(country_name, ''), upper(country_code)),
  base_currency,
  '[]'::jsonb,
  'exchange_rates'
from exchange_rates
where country_code is not null
on conflict (country_code) do update
set country_name = excluded.country_name,
    default_currency = coalesce(country_references.default_currency, excluded.default_currency),
    updated_at = now();

alter table country_references enable row level security;

drop policy if exists "country references public active select" on country_references;
create policy "country references public active select"
  on country_references
  for select
  using (status = 'active');

drop policy if exists "country references internal all" on country_references;
create policy "country references internal all"
  on country_references
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop trigger if exists country_references_updated_at on country_references;
create trigger country_references_updated_at
  before update on country_references
  for each row execute function set_updated_at();

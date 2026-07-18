-- @file 한글 책임: Supabase 마이그레이션 `partner receivable ledger`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

create table if not exists partner_receivable_ledger (
  id uuid primary key default gen_random_uuid(),
  agency_account_id uuid references agency_accounts(id),
  source_file_name text not null,
  source_year int not null,
  country_bucket text,
  partner_name text not null,
  currency text not null default 'KRW',
  carry_forward_amount numeric(14,2) not null default 0,
  payment_amount numeric(14,2) not null default 0,
  outstanding_amount numeric(14,2) not null default 0,
  total_tour_amount numeric(14,2) not null default 0,
  monthly_tour_amounts jsonb not null default '{}'::jsonb,
  match_status text not null default 'unmatched',
  imported_by uuid references profiles(id),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (currency in ('KRW', 'USD', 'SGD', 'JPY', 'EUR', 'CNY', 'MYR', 'THB', 'PHP', 'IDR', 'VND')),
  check (match_status in ('unmatched', 'matched_agency', 'matched_reservations', 'ignored'))
);

create index if not exists partner_receivable_ledger_agency_idx
  on partner_receivable_ledger(agency_account_id, source_year);

create index if not exists partner_receivable_ledger_partner_idx
  on partner_receivable_ledger(partner_name, currency, source_year);

create index if not exists partner_receivable_ledger_outstanding_idx
  on partner_receivable_ledger(currency, outstanding_amount);

alter table partner_receivable_ledger enable row level security;

drop policy if exists "partner receivable ledger finance only" on partner_receivable_ledger;
create policy "partner receivable ledger finance only"
  on partner_receivable_ledger
  for all
  using (has_finance_role())
  with check (has_finance_role());

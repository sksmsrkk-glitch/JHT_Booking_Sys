-- @file 한글 책임: Supabase 마이그레이션 `reservation final operation invoice`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

create table if not exists reservation_final_operation_snapshots (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id) on delete cascade,
  status text not null default 'draft',
  day_snapshots jsonb not null default '[]'::jsonb,
  hotel_snapshot jsonb not null default '[]'::jsonb,
  meal_snapshot jsonb not null default '[]'::jsonb,
  flight_details jsonb not null default '[]'::jsonb,
  bank_account_snapshot jsonb not null default '{}'::jsonb,
  operator_notes text,
  finalized_by uuid references profiles(id),
  finalized_at timestamptz,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'finalized')),
  check (status <> 'finalized' or finalized_at is not null)
);

create index if not exists reservation_final_operation_snapshots_status_idx
  on reservation_final_operation_snapshots(status, finalized_at);

alter table reservation_final_operation_snapshots enable row level security;

drop policy if exists "reservation final operation snapshots internal all" on reservation_final_operation_snapshots;
create policy "reservation final operation snapshots internal all"
  on reservation_final_operation_snapshots
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop trigger if exists reservation_final_operation_snapshots_updated_at on reservation_final_operation_snapshots;
create trigger reservation_final_operation_snapshots_updated_at
  before update on reservation_final_operation_snapshots
  for each row
  execute function set_updated_at();

drop policy if exists "invoices internal all" on invoices;
create policy "invoices internal all"
  on invoices
  for all
  using (has_finance_role() or has_internal_role())
  with check (has_finance_role() or has_internal_role());

drop policy if exists "invoice line items internal all" on invoice_line_items;
create policy "invoice line items internal all"
  on invoice_line_items
  for all
  using (has_finance_role() or has_internal_role())
  with check (has_finance_role() or has_internal_role());

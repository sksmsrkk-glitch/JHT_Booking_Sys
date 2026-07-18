-- @file 한글 책임: Supabase 마이그레이션 `invoice versioning`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

alter table invoices
  add column if not exists tour_code text,
  add column if not exists version_no integer not null default 1,
  add column if not exists collection_timing text,
  add column if not exists collection_status text not null default 'unpaid',
  add column if not exists deposit_required boolean not null default false,
  add column if not exists deposit_amount numeric(14,2),
  add column if not exists payment_deadline date,
  add column if not exists bank_account_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists flight_details jsonb not null default '[]'::jsonb,
  add column if not exists itinerary_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists invoice_payload jsonb not null default '{}'::jsonb;

create unique index if not exists invoices_tour_code_version_uidx
  on invoices(tour_code, version_no)
  where tour_code is not null;

create index if not exists invoices_collection_idx
  on invoices(collection_status, payment_deadline, tour_code);

create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  line_no integer not null default 1,
  description text not null,
  service_date date,
  category text,
  currency text not null default 'KRW',
  unit_amount numeric(14,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  unit_label text,
  total_amount numeric(14,2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_line_items_invoice_idx
  on invoice_line_items(invoice_id, line_no);

alter table invoice_line_items enable row level security;

drop policy if exists "invoice line items internal all" on invoice_line_items;
create policy "invoice line items internal all"
  on invoice_line_items
  for all
  using (has_finance_role() or has_internal_role())
  with check (has_finance_role());

drop policy if exists "invoice line items agency select" on invoice_line_items;
create policy "invoice line items agency select"
  on invoice_line_items
  for select
  using (
    exists (
      select 1
      from invoices i
      where i.id = invoice_line_items.invoice_id
        and can_access_reservation(i.reservation_id)
    )
  );

drop trigger if exists invoice_line_items_updated_at on invoice_line_items;
create trigger invoice_line_items_updated_at
  before update on invoice_line_items
  for each row
  execute function set_updated_at();

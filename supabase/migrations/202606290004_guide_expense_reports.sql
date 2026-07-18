-- @file 한글 책임: Supabase 마이그레이션 `guide expense reports`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

create table if not exists guide_expense_reports (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  report_no text not null unique,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  guide_name text,
  guide_phone text,
  tour_leader_name text,
  group_title text,
  pax_count integer,
  tour_start_date date,
  tour_end_date date,
  currency text not null default 'KRW',
  cash_advance_amount numeric(14, 2) not null default 0,
  total_lodging_amount numeric(14, 2) not null default 0,
  total_meal_amount numeric(14, 2) not null default 0,
  total_ticket_amount numeric(14, 2) not null default 0,
  total_cash_expense_amount numeric(14, 2) not null default 0,
  total_guide_fee_amount numeric(14, 2) not null default 0,
  total_shopping_commission_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  settlement_amount numeric(14, 2) not null default 0,
  source_workbook_summary jsonb not null default '{}'::jsonb,
  internal_notes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists guide_expense_reports_reservation_idx
  on guide_expense_reports(reservation_id);

create index if not exists guide_expense_reports_status_idx
  on guide_expense_reports(status, submitted_at);

create table if not exists guide_expense_report_lines (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references guide_expense_reports(id) on delete cascade,
  reservation_id uuid not null references reservations(id) on delete cascade,
  line_no integer not null,
  section text not null check (section in ('lodging', 'meal', 'ticket', 'cash_expense', 'guide_fee', 'shopping', 'other')),
  expense_date date,
  day_no integer,
  vendor_name text,
  description text not null,
  unit_amount numeric(14, 2) not null default 0,
  quantity numeric(10, 2) not null default 1,
  pax_count integer,
  total_amount numeric(14, 2) not null default 0,
  payment_method text,
  receipt_storage_path text,
  notes text,
  source_sheet_name text,
  source_sheet_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id, line_no)
);

create index if not exists guide_expense_report_lines_report_idx
  on guide_expense_report_lines(report_id, line_no);

create index if not exists guide_expense_report_lines_reservation_idx
  on guide_expense_report_lines(reservation_id, section);

alter table expenses
  add column if not exists source_guide_expense_report_line_id uuid references guide_expense_report_lines(id) on delete set null;

create unique index if not exists expenses_source_guide_expense_report_line_idx
  on expenses(source_guide_expense_report_line_id)
  where source_guide_expense_report_line_id is not null;

alter table guide_expense_reports enable row level security;
alter table guide_expense_report_lines enable row level security;

drop policy if exists "guide expense reports internal all" on guide_expense_reports;
create policy "guide expense reports internal all"
  on guide_expense_reports
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "guide expense report lines internal all" on guide_expense_report_lines;
create policy "guide expense report lines internal all"
  on guide_expense_report_lines
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop trigger if exists guide_expense_reports_updated_at on guide_expense_reports;
create trigger guide_expense_reports_updated_at
  before update on guide_expense_reports
  for each row execute function set_updated_at();

drop trigger if exists guide_expense_report_lines_updated_at on guide_expense_report_lines;
create trigger guide_expense_report_lines_updated_at
  before update on guide_expense_report_lines
  for each row execute function set_updated_at();

create extension if not exists "pgcrypto";
create extension if not exists "citext";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'sales', 'operations', 'hotel_booking', 'vehicle_booking', 'guide_assignment', 'content_booking', 'finance', 'agency_user');
  end if;
  if not exists (select 1 from pg_type where typname = 'record_status') then
    create type record_status as enum ('active', 'inactive', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'agency_inquiry_type') then
    create type agency_inquiry_type as enum ('new_inquiry', 'revision_request', 'booking_request', 'change_request', 'cancellation_request', 'existing_product_inquiry');
  end if;
  if not exists (select 1 from pg_type where typname = 'supplier_category') then
    create type supplier_category as enum ('hotel', 'vehicle', 'restaurant', 'attraction', 'guide', 'shopping', 'local_government', 'tourism_board', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'supplier_product_type') then
    create type supplier_product_type as enum ('room', 'vehicle', 'meal', 'ticket', 'guide_service', 'meeting_room', 'shopping_commission', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'pricing_unit') then
    create type pricing_unit as enum ('per_person', 'per_group', 'per_room', 'per_vehicle', 'per_guide', 'per_day');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type quote_status as enum ('new', 'triage', 'quoting', 'sent', 'revision_requested', 'accepted', 'cancelled', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_version_status') then
    create type quote_version_status as enum ('draft', 'review', 'sent', 'accepted', 'superseded', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'tour_type') then
    create type tour_type as enum ('series_package', 'incentive_tour', 'private_tour', 'mice', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum ('pending', 'requested', 'confirmed', 'on_tour', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'operation_team') then
    create type operation_team as enum ('sales', 'operations', 'hotel_booking', 'vehicle_booking', 'guide_assignment', 'content_booking', 'finance');
  end if;
  if not exists (select 1 from pg_type where typname = 'operation_task_status') then
    create type operation_task_status as enum ('todo', 'blocked', 'in_progress', 'done', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'supplier_message_type') then
    create type supplier_message_type as enum ('booking_request', 'confirmation_request', 'change_request', 'cancellation_request', 'final_confirmation', 'pre_event_reminder');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_channel') then
    create type message_channel as enum ('email', 'kakao_alimtalk', 'kakao_friendtalk', 'internal');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_status') then
    create type message_status as enum ('draft', 'pending_approval', 'approved', 'queued', 'sending', 'sent', 'failed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'risk_level') then
    create type risk_level as enum ('normal', 'high');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'void', 'overdue');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'confirmed', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'settlement_status') then
    create type settlement_status as enum ('draft', 'review', 'approved', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'migration_status') then
    create type migration_status as enum ('uploaded', 'mapped', 'validated', 'approved', 'imported', 'failed');
  end if;
end $$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ko text not null,
  name_en text not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text,
  default_company_id uuid references companies(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role app_role not null,
  team operation_team,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table agency_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  country_code text,
  email_domain text,
  phone text,
  website text,
  billing_currency text not null default 'KRW',
  google_drive_folder_url text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agency_users (
  id uuid primary key default gen_random_uuid(),
  agency_account_id uuid not null references agency_accounts(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  email citext not null,
  name text not null,
  title text,
  is_account_admin boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_account_id, email)
);

create table agency_contacts (
  id uuid primary key default gen_random_uuid(),
  agency_account_id uuid not null references agency_accounts(id) on delete cascade,
  name text not null,
  email citext,
  phone text,
  role text,
  receives_quotes boolean not null default false,
  receives_invoices boolean not null default false,
  notes text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agency_inquiries (
  id uuid primary key default gen_random_uuid(),
  agency_account_id uuid not null references agency_accounts(id),
  submitted_by_agency_user_id uuid references agency_users(id),
  inquiry_type agency_inquiry_type not null,
  title text not null,
  requested_start_date date,
  requested_end_date date,
  pax_count integer check (pax_count is null or pax_count > 0),
  preferred_language text,
  tour_type tour_type,
  source_channel text not null default 'portal',
  related_quote_case_id uuid,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table domestic_suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  category supplier_category not null,
  name_ko text not null,
  name_en text,
  search_keywords text,
  region_level1 text,
  region_level2 text,
  address text,
  google_place_id text,
  naver_map_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone text,
  website text,
  status record_status not null default 'active',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  domestic_supplier_id uuid not null references domestic_suppliers(id) on delete cascade,
  name text not null,
  title text,
  email citext,
  phone text,
  kakao_available boolean not null default false,
  receives_booking_messages boolean not null default true,
  notes text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier_products (
  id uuid primary key default gen_random_uuid(),
  domestic_supplier_id uuid not null references domestic_suppliers(id) on delete cascade,
  product_type supplier_product_type not null,
  name_ko text not null,
  name_en text,
  search_name text not null,
  description text,
  capacity integer check (capacity is null or capacity >= 0),
  room_type text,
  breakfast_included boolean,
  vehicle_seat_count integer check (vehicle_seat_count is null or vehicle_seat_count > 0),
  menu_tags text[],
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier_prices (
  id uuid primary key default gen_random_uuid(),
  supplier_product_id uuid not null references supplier_products(id) on delete cascade,
  pricing_unit pricing_unit not null,
  currency text not null default 'KRW',
  cost_amount numeric(14,2) not null check (cost_amount >= 0),
  staff_discount_amount numeric(14,2),
  min_pax integer check (min_pax is null or min_pax > 0),
  max_pax integer check (max_pax is null or max_pax >= min_pax),
  season_label text,
  valid_from date,
  valid_to date,
  weekday_rule text,
  includes_tax boolean not null default true,
  notes text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table supplier_media (
  id uuid primary key default gen_random_uuid(),
  domestic_supplier_id uuid references domestic_suppliers(id) on delete cascade,
  supplier_product_id uuid references supplier_products(id) on delete cascade,
  media_type text not null,
  storage_path text not null,
  public_label text,
  created_at timestamptz not null default now(),
  check (domestic_supplier_id is not null or supplier_product_id is not null)
);

create table quote_cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  agency_account_id uuid not null references agency_accounts(id),
  agency_inquiry_id uuid references agency_inquiries(id),
  case_code text not null unique,
  share_id text not null unique,
  tour_name text not null,
  tour_type tour_type,
  status quote_status not null default 'new',
  currency text not null default 'KRW',
  estimated_pax integer check (estimated_pax is null or estimated_pax > 0),
  start_date date,
  end_date date,
  gmail_thread_id text,
  internal_owner_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agency_inquiries
  add constraint agency_inquiries_related_quote_case_fk
  foreign key (related_quote_case_id) references quote_cases(id);

create table quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_case_id uuid not null references quote_cases(id) on delete cascade,
  version_no integer not null,
  status quote_version_status not null default 'draft',
  margin_mode text not null default 'auto_rate',
  default_margin_rate numeric(8,4) not null default 0,
  currency text not null default 'KRW',
  exchange_rate_to_krw numeric(14,6) not null default 1,
  agency_visible_summary jsonb not null default '{}'::jsonb,
  public_total_amount numeric(14,2) not null default 0,
  internal_total_cost_krw numeric(14,2) not null default 0,
  internal_total_margin_krw numeric(14,2) not null default 0,
  terms_and_conditions text,
  created_by uuid references profiles(id),
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_case_id, version_no)
);

create table quote_itinerary_days (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id) on delete cascade,
  day_no integer not null check (day_no > 0),
  service_date date,
  title text,
  meal_summary jsonb not null default '{}'::jsonb,
  public_description text,
  internal_notes text,
  unique (quote_version_id, day_no)
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id) on delete cascade,
  itinerary_day_id uuid references quote_itinerary_days(id) on delete set null,
  source_supplier_product_id uuid references supplier_products(id),
  source_supplier_price_id uuid references supplier_prices(id),
  item_category supplier_product_type not null,
  snapshot_item_name text not null,
  snapshot_supplier_name text,
  snapshot_cost_currency text not null default 'KRW',
  snapshot_unit_cost_amount numeric(14,2) not null default 0,
  exchange_rate_to_krw numeric(14,6) not null default 1,
  pricing_unit pricing_unit not null,
  quantity numeric(12,2) not null default 1,
  pax_count integer check (pax_count is null or pax_count > 0),
  margin_mode text not null default 'auto_rate',
  margin_rate numeric(8,4),
  manual_margin_amount numeric(14,2),
  total_cost_krw numeric(14,2) not null default 0,
  total_sell_amount numeric(14,2) not null default 0,
  partner_visible_notes text,
  internal_notes text,
  created_at timestamptz not null default now()
);

create table route_segments (
  id uuid primary key default gen_random_uuid(),
  quote_itinerary_day_id uuid not null references quote_itinerary_days(id) on delete cascade,
  seq integer not null check (seq > 0),
  origin_label text not null,
  destination_label text not null,
  origin_place_id text,
  destination_place_id text,
  travel_minutes integer check (travel_minutes is null or travel_minutes >= 0),
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  provider text not null default 'google_maps',
  provider_payload jsonb not null default '{}'::jsonb,
  manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  unique (quote_itinerary_day_id, seq)
);

create table quote_exports (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id) on delete cascade,
  export_type text not null default 'xlsx',
  storage_path text,
  status text not null default 'queued',
  error_message text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  quote_case_id uuid not null references quote_cases(id),
  accepted_quote_version_id uuid references quote_versions(id),
  reservation_code text not null unique,
  agency_account_id uuid not null references agency_accounts(id),
  status reservation_status not null default 'pending',
  tour_start_date date,
  tour_end_date date,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  from_status reservation_status,
  to_status reservation_status not null,
  reason text,
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table rooming_lists (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  uploaded_by_agency_user_id uuid references agency_users(id),
  original_filename text,
  storage_path text,
  revision_no integer not null default 1,
  parsed_status text not null default 'uploaded',
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (reservation_id, revision_no),
  unique (idempotency_key)
);

create table passengers (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  rooming_list_id uuid references rooming_lists(id) on delete set null,
  passenger_no text,
  full_name text not null,
  gender text,
  date_of_birth date,
  dietary_requirements text,
  passport_no text,
  coach_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (reservation_id, passenger_no)
);

create table room_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  rooming_list_id uuid references rooming_lists(id) on delete set null,
  room_no text,
  room_type text not null,
  passenger_ids uuid[] not null default '{}',
  check_in date,
  check_out date,
  notes text,
  created_at timestamptz not null default now()
);

create table operation_tasks (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  domestic_supplier_id uuid references domestic_suppliers(id),
  team operation_team not null,
  task_type text not null,
  title text not null,
  status operation_task_status not null default 'todo',
  assigned_to uuid references profiles(id),
  due_at timestamptz,
  completed_at timestamptz,
  blocked_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id, task_type, domestic_supplier_id)
);

create table operation_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references operation_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references operation_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table operation_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  team operation_team,
  threshold_hours integer not null,
  escalation_level text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table operation_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  operation_task_id uuid not null references operation_tasks(id) on delete cascade,
  reminder_rule_id uuid references operation_reminder_rules(id),
  channel message_channel not null default 'internal',
  sent_to jsonb not null default '[]'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

create table supplier_message_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  supplier_category supplier_category,
  message_type supplier_message_type not null,
  channel message_channel not null,
  locale text not null default 'ko-KR',
  subject_template text,
  body_template text not null,
  kakao_template_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier_message_outbox (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  domestic_supplier_id uuid not null references domestic_suppliers(id),
  supplier_contact_id uuid references supplier_contacts(id),
  template_id uuid references supplier_message_templates(id),
  message_type supplier_message_type not null,
  channel message_channel not null,
  risk_level risk_level not null default 'normal',
  status message_status not null default 'draft',
  subject text,
  body text not null,
  idempotency_key text not null unique,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  second_approved_by uuid references profiles(id),
  second_approved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved', 'queued', 'sending', 'sent') or (approved_by is not null and approved_at is not null)),
  check (message_type <> 'cancellation_request' or status not in ('queued', 'sending', 'sent') or second_approved_by is not null)
);

create table supplier_message_events (
  id uuid primary key default gen_random_uuid(),
  supplier_message_outbox_id uuid not null references supplier_message_outbox(id) on delete cascade,
  event_type text not null,
  provider text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  invoice_no text not null unique,
  status invoice_status not null default 'draft',
  currency text not null default 'KRW',
  total_amount numeric(14,2) not null default 0,
  issued_at timestamptz,
  due_date date,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  status payment_status not null default 'pending',
  currency text not null default 'KRW',
  amount numeric(14,2) not null check (amount >= 0),
  received_at timestamptz,
  method text,
  reference_no text,
  idempotency_key text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create unique index payments_idempotency_key_uidx on payments(idempotency_key) where idempotency_key is not null;

create table expenses (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  domestic_supplier_id uuid references domestic_suppliers(id),
  expense_date date,
  category text not null,
  description text not null,
  currency text not null default 'KRW',
  amount numeric(14,2) not null check (amount >= 0),
  receipt_storage_path text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table extra_revenues (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  revenue_type text not null,
  description text,
  currency text not null default 'KRW',
  amount numeric(14,2) not null check (amount >= 0),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table shopping_commissions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  domestic_supplier_id uuid references domestic_suppliers(id),
  shop_name text not null,
  visit_date date,
  sales_amount numeric(14,2) default 0,
  commission_amount numeric(14,2) not null default 0,
  currency text not null default 'KRW',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id) on delete cascade,
  status settlement_status not null default 'draft',
  total_invoice_amount numeric(14,2) not null default 0,
  total_payment_amount numeric(14,2) not null default 0,
  total_expense_amount numeric(14,2) not null default 0,
  total_extra_revenue_amount numeric(14,2) not null default 0,
  total_shopping_commission_amount numeric(14,2) not null default 0,
  final_profit_amount numeric(14,2) not null default 0,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table email_threads (
  id uuid primary key default gen_random_uuid(),
  gmail_thread_id text not null unique,
  quote_case_id uuid references quote_cases(id),
  reservation_id uuid references reservations(id),
  agency_account_id uuid references agency_accounts(id),
  match_confidence numeric(4,2),
  requires_manual_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table email_messages (
  id uuid primary key default gen_random_uuid(),
  email_thread_id uuid references email_threads(id) on delete cascade,
  gmail_message_id text not null unique,
  from_email citext,
  to_emails citext[],
  cc_emails citext[],
  subject text,
  body_text text,
  received_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table email_attachments (
  id uuid primary key default gen_random_uuid(),
  email_message_id uuid not null references email_messages(id) on delete cascade,
  filename text not null,
  mime_type text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references profiles(id),
  operation_task_id uuid references operation_tasks(id),
  channel message_channel not null default 'internal',
  title text not null,
  body text,
  status text not null default 'queued',
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table migration_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_kind text not null default 'notion_csv',
  target_table text not null,
  status migration_status not null default 'uploaded',
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staging_rows (
  id uuid primary key default gen_random_uuid(),
  migration_batch_id uuid not null references migration_batches(id) on delete cascade,
  row_no integer not null,
  raw_payload jsonb not null,
  mapped_payload jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (migration_batch_id, row_no)
);

create table migration_errors (
  id uuid primary key default gen_random_uuid(),
  migration_batch_id uuid not null references migration_batches(id) on delete cascade,
  staging_row_id uuid references staging_rows(id) on delete cascade,
  error_code text not null,
  error_message text not null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id),
  action text not null,
  entity_table text not null,
  entity_id uuid,
  risk_level risk_level not null default 'normal',
  before_data jsonb,
  after_data jsonb,
  approval_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create table api_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  endpoint text,
  method text,
  status_code integer,
  request_payload jsonb,
  response_payload jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index agency_accounts_company_idx on agency_accounts(company_id);
create index agency_users_auth_idx on agency_users(auth_user_id);
create index agency_inquiries_agency_idx on agency_inquiries(agency_account_id);
create index domestic_suppliers_category_region_idx on domestic_suppliers(category, region_level1, status);
create index supplier_products_search_idx on supplier_products using gin (to_tsvector('simple', coalesce(search_name, '') || ' ' || coalesce(name_ko, '') || ' ' || coalesce(name_en, '')));
create index supplier_prices_product_idx on supplier_prices(supplier_product_id, status, valid_from, valid_to);
create index quote_cases_agency_status_idx on quote_cases(agency_account_id, status);
create index quote_versions_case_idx on quote_versions(quote_case_id, version_no);
create index reservations_agency_status_idx on reservations(agency_account_id, status);
create index operation_tasks_reservation_team_idx on operation_tasks(reservation_id, team, status);
create index supplier_message_outbox_status_idx on supplier_message_outbox(status, channel, message_type);
create index invoices_reservation_idx on invoices(reservation_id);
create index email_messages_gmail_thread_idx on email_messages(email_thread_id);

create trigger companies_updated_at before update on companies for each row execute function set_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger agency_accounts_updated_at before update on agency_accounts for each row execute function set_updated_at();
create trigger agency_users_updated_at before update on agency_users for each row execute function set_updated_at();
create trigger agency_contacts_updated_at before update on agency_contacts for each row execute function set_updated_at();
create trigger agency_inquiries_updated_at before update on agency_inquiries for each row execute function set_updated_at();
create trigger domestic_suppliers_updated_at before update on domestic_suppliers for each row execute function set_updated_at();
create trigger supplier_contacts_updated_at before update on supplier_contacts for each row execute function set_updated_at();
create trigger supplier_products_updated_at before update on supplier_products for each row execute function set_updated_at();
create trigger supplier_prices_updated_at before update on supplier_prices for each row execute function set_updated_at();
create trigger quote_cases_updated_at before update on quote_cases for each row execute function set_updated_at();
create trigger quote_versions_updated_at before update on quote_versions for each row execute function set_updated_at();
create trigger reservations_updated_at before update on reservations for each row execute function set_updated_at();
create trigger operation_tasks_updated_at before update on operation_tasks for each row execute function set_updated_at();
create trigger supplier_message_templates_updated_at before update on supplier_message_templates for each row execute function set_updated_at();
create trigger supplier_message_outbox_updated_at before update on supplier_message_outbox for each row execute function set_updated_at();
create trigger invoices_updated_at before update on invoices for each row execute function set_updated_at();
create trigger settlements_updated_at before update on settlements for each row execute function set_updated_at();
create trigger email_threads_updated_at before update on email_threads for each row execute function set_updated_at();
create trigger migration_batches_updated_at before update on migration_batches for each row execute function set_updated_at();

create or replace function has_internal_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles
    where user_id = auth.uid()
      and role in ('admin', 'sales', 'operations', 'hotel_booking', 'vehicle_booking', 'guide_assignment', 'content_booking', 'finance')
  );
$$;

create or replace function has_finance_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles
    where user_id = auth.uid()
      and role in ('admin', 'finance')
  );
$$;

create or replace function is_agency_member(agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from agency_users
    where agency_account_id = agency_id
      and auth_user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function can_access_quote_case(case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from quote_cases qc
    where qc.id = case_id
      and (has_internal_role() or is_agency_member(qc.agency_account_id))
  );
$$;

create or replace function can_access_reservation(res_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from reservations r
    where r.id = res_id
      and (has_internal_role() or is_agency_member(r.agency_account_id))
  );
$$;

alter table companies enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table agency_accounts enable row level security;
alter table agency_users enable row level security;
alter table agency_contacts enable row level security;
alter table agency_inquiries enable row level security;
alter table domestic_suppliers enable row level security;
alter table supplier_contacts enable row level security;
alter table supplier_products enable row level security;
alter table supplier_prices enable row level security;
alter table supplier_media enable row level security;
alter table quote_cases enable row level security;
alter table quote_versions enable row level security;
alter table quote_itinerary_days enable row level security;
alter table quote_items enable row level security;
alter table route_segments enable row level security;
alter table quote_exports enable row level security;
alter table reservations enable row level security;
alter table reservation_status_history enable row level security;
alter table rooming_lists enable row level security;
alter table passengers enable row level security;
alter table room_assignments enable row level security;
alter table operation_tasks enable row level security;
alter table operation_task_dependencies enable row level security;
alter table operation_reminder_rules enable row level security;
alter table operation_reminder_logs enable row level security;
alter table supplier_message_templates enable row level security;
alter table supplier_message_outbox enable row level security;
alter table supplier_message_events enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table extra_revenues enable row level security;
alter table shopping_commissions enable row level security;
alter table settlements enable row level security;
alter table email_threads enable row level security;
alter table email_messages enable row level security;
alter table email_attachments enable row level security;
alter table notifications enable row level security;
alter table migration_batches enable row level security;
alter table staging_rows enable row level security;
alter table migration_errors enable row level security;
alter table audit_logs enable row level security;
alter table api_logs enable row level security;

create policy "internal can manage companies" on companies for all using (has_internal_role()) with check (has_internal_role());
create policy "profiles self select" on profiles for select using (id = auth.uid() or has_internal_role());
create policy "profiles self update" on profiles for update using (id = auth.uid() or has_internal_role()) with check (id = auth.uid() or has_internal_role());
create policy "internal can manage user roles" on user_roles for all using (has_internal_role()) with check (has_internal_role());

create policy "agency accounts internal all" on agency_accounts for all using (has_internal_role()) with check (has_internal_role());
create policy "agency accounts member select" on agency_accounts for select using (is_agency_member(id));

create policy "agency users internal all" on agency_users for all using (has_internal_role()) with check (has_internal_role());
create policy "agency users same agency select" on agency_users for select using (is_agency_member(agency_account_id));
create policy "agency users self update" on agency_users for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "agency contacts internal all" on agency_contacts for all using (has_internal_role()) with check (has_internal_role());
create policy "agency contacts same agency select" on agency_contacts for select using (is_agency_member(agency_account_id));

create policy "agency inquiries internal all" on agency_inquiries for all using (has_internal_role()) with check (has_internal_role());
create policy "agency inquiries same agency select" on agency_inquiries for select using (is_agency_member(agency_account_id));
create policy "agency inquiries same agency insert" on agency_inquiries for insert with check (is_agency_member(agency_account_id));

create policy "domestic suppliers internal only" on domestic_suppliers for all using (has_internal_role()) with check (has_internal_role());
create policy "supplier contacts internal only" on supplier_contacts for all using (has_internal_role()) with check (has_internal_role());
create policy "supplier products internal only" on supplier_products for all using (has_internal_role()) with check (has_internal_role());
create policy "supplier prices internal only" on supplier_prices for all using (has_internal_role()) with check (has_internal_role());
create policy "supplier media internal only" on supplier_media for all using (has_internal_role()) with check (has_internal_role());

create policy "quote cases internal all" on quote_cases for all using (has_internal_role()) with check (has_internal_role());
create policy "quote cases agency select" on quote_cases for select using (is_agency_member(agency_account_id));

create policy "quote versions internal all" on quote_versions for all using (has_internal_role()) with check (has_internal_role());
create policy "quote versions agency select" on quote_versions for select using (
  exists (
    select 1 from quote_cases qc
    where qc.id = quote_versions.quote_case_id
      and is_agency_member(qc.agency_account_id)
      and quote_versions.status in ('sent', 'accepted', 'superseded')
  )
);

create policy "quote itinerary internal all" on quote_itinerary_days for all using (has_internal_role()) with check (has_internal_role());
create policy "quote itinerary agency select" on quote_itinerary_days for select using (
  exists (
    select 1
    from quote_versions qv
    join quote_cases qc on qc.id = qv.quote_case_id
    where qv.id = quote_itinerary_days.quote_version_id
      and is_agency_member(qc.agency_account_id)
      and qv.status in ('sent', 'accepted', 'superseded')
  )
);

create policy "quote items internal only" on quote_items for all using (has_internal_role()) with check (has_internal_role());
create policy "route segments internal all" on route_segments for all using (has_internal_role()) with check (has_internal_role());
create policy "route segments agency select" on route_segments for select using (
  exists (
    select 1
    from quote_itinerary_days qid
    join quote_versions qv on qv.id = qid.quote_version_id
    join quote_cases qc on qc.id = qv.quote_case_id
    where qid.id = route_segments.quote_itinerary_day_id
      and is_agency_member(qc.agency_account_id)
      and qv.status in ('sent', 'accepted', 'superseded')
  )
);
create policy "quote exports internal only" on quote_exports for all using (has_internal_role()) with check (has_internal_role());

create policy "reservations internal all" on reservations for all using (has_internal_role()) with check (has_internal_role());
create policy "reservations agency select" on reservations for select using (is_agency_member(agency_account_id));

create policy "reservation status internal all" on reservation_status_history for all using (has_internal_role()) with check (has_internal_role());
create policy "reservation status agency select" on reservation_status_history for select using (can_access_reservation(reservation_id));

create policy "rooming lists internal all" on rooming_lists for all using (has_internal_role()) with check (has_internal_role());
create policy "rooming lists agency select" on rooming_lists for select using (can_access_reservation(reservation_id));
create policy "rooming lists agency insert" on rooming_lists for insert with check (can_access_reservation(reservation_id));

create policy "passengers internal all" on passengers for all using (has_internal_role()) with check (has_internal_role());
create policy "passengers agency select" on passengers for select using (can_access_reservation(reservation_id));
create policy "passengers agency insert" on passengers for insert with check (can_access_reservation(reservation_id));

create policy "room assignments internal all" on room_assignments for all using (has_internal_role()) with check (has_internal_role());
create policy "room assignments agency select" on room_assignments for select using (can_access_reservation(reservation_id));

create policy "operation tasks internal only" on operation_tasks for all using (has_internal_role()) with check (has_internal_role());
create policy "operation dependencies internal only" on operation_task_dependencies for all using (has_internal_role()) with check (has_internal_role());
create policy "operation reminder rules internal only" on operation_reminder_rules for all using (has_internal_role()) with check (has_internal_role());
create policy "operation reminder logs internal only" on operation_reminder_logs for all using (has_internal_role()) with check (has_internal_role());

create policy "supplier templates internal only" on supplier_message_templates for all using (has_internal_role()) with check (has_internal_role());
create policy "supplier outbox internal only" on supplier_message_outbox for all using (has_internal_role()) with check (has_internal_role());
create policy "supplier events internal only" on supplier_message_events for all using (has_internal_role()) with check (has_internal_role());

create policy "invoices internal all" on invoices for all using (has_finance_role() or has_internal_role()) with check (has_finance_role());
create policy "invoices agency select" on invoices for select using (can_access_reservation(reservation_id));
create policy "payments finance only" on payments for all using (has_finance_role()) with check (has_finance_role());
create policy "payments agency select" on payments for select using (
  exists (
    select 1 from invoices i
    where i.id = payments.invoice_id
      and can_access_reservation(i.reservation_id)
  )
);

create policy "expenses finance internal only" on expenses for all using (has_finance_role()) with check (has_finance_role());
create policy "extra revenues finance internal only" on extra_revenues for all using (has_finance_role()) with check (has_finance_role());
create policy "shopping commissions finance internal only" on shopping_commissions for all using (has_finance_role()) with check (has_finance_role());
create policy "settlements finance internal only" on settlements for all using (has_finance_role()) with check (has_finance_role());

create policy "email threads internal all" on email_threads for all using (has_internal_role()) with check (has_internal_role());
create policy "email messages internal all" on email_messages for all using (has_internal_role()) with check (has_internal_role());
create policy "email attachments internal all" on email_attachments for all using (has_internal_role()) with check (has_internal_role());

create policy "notifications internal all" on notifications for all using (has_internal_role()) with check (has_internal_role());
create policy "notifications recipient select" on notifications for select using (recipient_profile_id = auth.uid());

create policy "migration batches internal only" on migration_batches for all using (has_internal_role()) with check (has_internal_role());
create policy "staging rows internal only" on staging_rows for all using (has_internal_role()) with check (has_internal_role());
create policy "migration errors internal only" on migration_errors for all using (has_internal_role()) with check (has_internal_role());
create policy "audit logs internal read insert" on audit_logs for select using (has_internal_role());
create policy "audit logs internal insert" on audit_logs for insert with check (has_internal_role());
create policy "api logs internal read insert" on api_logs for select using (has_internal_role());
create policy "api logs internal insert" on api_logs for insert with check (has_internal_role());

insert into operation_reminder_rules (code, threshold_hours, escalation_level)
values
  ('due_48h', 48, 'assignee'),
  ('due_24h', 24, 'assignee_and_team_lead'),
  ('overdue', 0, 'assignee_team_lead_admin')
on conflict (code) do nothing;

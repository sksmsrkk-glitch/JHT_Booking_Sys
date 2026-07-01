do $$ begin
  create type agency_application_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type agency_lifecycle_status as enum ('pending_approval', 'active', 'frozen', 'withdrawn', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type agency_user_role as enum ('mother', 'sub_account');
exception
  when duplicate_object then null;
end $$;

create table if not exists agency_signup_applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  phone text,
  email citext not null,
  country_code text not null,
  country_name text,
  website text,
  notes text,
  status agency_application_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_agency_account_id uuid references agency_accounts(id),
  created_mother_agency_user_id uuid references agency_users(id),
  email_notification_status text not null default 'not_sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_signup_applications_status_idx
  on agency_signup_applications(status, created_at desc);

alter table agency_accounts
  add column if not exists lifecycle_status agency_lifecycle_status not null default 'active',
  add column if not exists approved_at timestamptz,
  add column if not exists frozen_at timestamptz,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists last_login_at timestamptz;

alter table agency_users
  add column if not exists account_role agency_user_role not null default 'sub_account',
  add column if not exists parent_agency_user_id uuid references agency_users(id) on delete set null,
  add column if not exists password_reset_required boolean not null default true,
  add column if not exists forced_withdrawn_at timestamptz,
  add column if not exists last_login_at timestamptz;

create table if not exists agency_account_email_events (
  id uuid primary key default gen_random_uuid(),
  agency_account_id uuid references agency_accounts(id) on delete cascade,
  agency_user_id uuid references agency_users(id) on delete set null,
  signup_application_id uuid references agency_signup_applications(id) on delete set null,
  event_type text not null,
  recipient_email citext not null,
  subject text not null,
  body text not null,
  delivery_status text not null default 'queued',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists agency_login_events (
  id uuid primary key default gen_random_uuid(),
  agency_account_id uuid references agency_accounts(id) on delete cascade,
  agency_user_id uuid references agency_users(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  event_type text not null default 'login',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table agency_signup_applications enable row level security;
alter table agency_account_email_events enable row level security;
alter table agency_login_events enable row level security;

drop policy if exists "agency signup applications public insert" on agency_signup_applications;
create policy "agency signup applications public insert"
  on agency_signup_applications
  for insert
  with check (true);

drop policy if exists "agency signup applications internal all" on agency_signup_applications;
create policy "agency signup applications internal all"
  on agency_signup_applications
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "agency account email events internal all" on agency_account_email_events;
create policy "agency account email events internal all"
  on agency_account_email_events
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "agency login events internal all" on agency_login_events;
create policy "agency login events internal all"
  on agency_login_events
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "agency login events agency insert" on agency_login_events;
create policy "agency login events agency insert"
  on agency_login_events
  for insert
  with check (is_agency_member(agency_account_id));

drop trigger if exists agency_signup_applications_updated_at on agency_signup_applications;
create trigger agency_signup_applications_updated_at
  before update on agency_signup_applications
  for each row execute function set_updated_at();

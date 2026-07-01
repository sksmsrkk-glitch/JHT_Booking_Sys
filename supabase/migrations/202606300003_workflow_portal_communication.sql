create table if not exists workflow_threads (
  id uuid primary key default gen_random_uuid(),
  workflow_code text not null unique,
  agency_account_id uuid references agency_accounts(id) on delete set null,
  agency_inquiry_id uuid references agency_inquiries(id) on delete set null,
  quote_case_id uuid references quote_cases(id) on delete set null,
  reservation_id uuid references reservations(id) on delete set null,
  current_invoice_id uuid references invoices(id) on delete set null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'waiting_partner', 'waiting_internal', 'resolved', 'closed', 'cancelled')),
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_threads_agency_idx
  on workflow_threads(agency_account_id, status, last_message_at desc);

create index if not exists workflow_threads_quote_idx
  on workflow_threads(quote_case_id);

create index if not exists workflow_threads_reservation_idx
  on workflow_threads(reservation_id);

create table if not exists workflow_messages (
  id uuid primary key default gen_random_uuid(),
  workflow_thread_id uuid not null references workflow_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('agency', 'internal', 'system')),
  sender_name text,
  sender_email citext,
  message_type text not null default 'general' check (
    message_type in (
      'general',
      'new_inquiry',
      'quote_revision',
      'hotel_change',
      'meal_change',
      'vehicle_change',
      'attraction_change',
      'cancellation',
      'invoice_question',
      'finance_follow_up',
      'operation_update'
    )
  ),
  body text not null,
  visibility text not null default 'partner_visible' check (visibility in ('partner_visible', 'internal_only')),
  linked_quote_version_id uuid references quote_versions(id) on delete set null,
  linked_invoice_id uuid references invoices(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists workflow_messages_thread_idx
  on workflow_messages(workflow_thread_id, created_at);

create index if not exists workflow_messages_type_idx
  on workflow_messages(message_type, created_at desc);

create table if not exists workflow_action_items (
  id uuid primary key default gen_random_uuid(),
  workflow_thread_id uuid not null references workflow_threads(id) on delete cascade,
  source_message_id uuid references workflow_messages(id) on delete set null,
  category text not null default 'other' check (category in ('hotel', 'meal', 'vehicle', 'attraction', 'guide', 'invoice', 'finance', 'inspection', 'other')),
  title text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'replied', 'resolved', 'cancelled')),
  partner_visible boolean not null default true,
  linked_quote_version_id uuid references quote_versions(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_action_items_thread_idx
  on workflow_action_items(workflow_thread_id, status, category);

create table if not exists workflow_attachments (
  id uuid primary key default gen_random_uuid(),
  workflow_message_id uuid not null references workflow_messages(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  visibility text not null default 'partner_visible' check (visibility in ('partner_visible', 'internal_only')),
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists workflow_attachments_message_idx
  on workflow_attachments(workflow_message_id);

drop trigger if exists workflow_threads_updated_at on workflow_threads;
create trigger workflow_threads_updated_at
  before update on workflow_threads
  for each row
  execute function set_updated_at();

drop trigger if exists workflow_action_items_updated_at on workflow_action_items;
create trigger workflow_action_items_updated_at
  before update on workflow_action_items
  for each row
  execute function set_updated_at();

alter table workflow_threads enable row level security;
alter table workflow_messages enable row level security;
alter table workflow_action_items enable row level security;
alter table workflow_attachments enable row level security;

drop policy if exists "workflow threads internal all" on workflow_threads;
create policy "workflow threads internal all"
  on workflow_threads
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "workflow threads agency select" on workflow_threads;
create policy "workflow threads agency select"
  on workflow_threads
  for select
  using (agency_account_id is not null and is_agency_member(agency_account_id));

drop policy if exists "workflow threads agency insert" on workflow_threads;
create policy "workflow threads agency insert"
  on workflow_threads
  for insert
  with check (agency_account_id is not null and is_agency_member(agency_account_id));

drop policy if exists "workflow messages internal all" on workflow_messages;
create policy "workflow messages internal all"
  on workflow_messages
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "workflow messages agency select" on workflow_messages;
create policy "workflow messages agency select"
  on workflow_messages
  for select
  using (
    visibility = 'partner_visible'
    and exists (
      select 1
      from workflow_threads wt
      where wt.id = workflow_messages.workflow_thread_id
        and wt.agency_account_id is not null
        and is_agency_member(wt.agency_account_id)
    )
  );

drop policy if exists "workflow messages agency insert" on workflow_messages;
create policy "workflow messages agency insert"
  on workflow_messages
  for insert
  with check (
    sender_type = 'agency'
    and visibility = 'partner_visible'
    and exists (
      select 1
      from workflow_threads wt
      where wt.id = workflow_messages.workflow_thread_id
        and wt.agency_account_id is not null
        and is_agency_member(wt.agency_account_id)
    )
  );

drop policy if exists "workflow action items internal all" on workflow_action_items;
create policy "workflow action items internal all"
  on workflow_action_items
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "workflow action items agency select" on workflow_action_items;
create policy "workflow action items agency select"
  on workflow_action_items
  for select
  using (
    partner_visible = true
    and exists (
      select 1
      from workflow_threads wt
      where wt.id = workflow_action_items.workflow_thread_id
        and wt.agency_account_id is not null
        and is_agency_member(wt.agency_account_id)
    )
  );

drop policy if exists "workflow attachments internal all" on workflow_attachments;
create policy "workflow attachments internal all"
  on workflow_attachments
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop policy if exists "workflow attachments agency select" on workflow_attachments;
create policy "workflow attachments agency select"
  on workflow_attachments
  for select
  using (
    visibility = 'partner_visible'
    and exists (
      select 1
      from workflow_messages wm
      join workflow_threads wt on wt.id = wm.workflow_thread_id
      where wm.id = workflow_attachments.workflow_message_id
        and wm.visibility = 'partner_visible'
        and wt.agency_account_id is not null
        and is_agency_member(wt.agency_account_id)
    )
  );

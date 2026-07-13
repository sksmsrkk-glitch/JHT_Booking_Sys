-- 최초 문의에서 발급한 workflow code를 견적, 예약, 인보이스, 가이드 비용까지 동일하게 유지합니다.
-- API를 우회한 직접 쓰기에서도 코드가 갈라지지 않도록 DB trigger가 최종 규칙을 강제합니다.

alter type message_status add value if not exists 'simulated' after 'sending';

-- 기존 데이터가 있는 환경에서는 최초 견적 코드로 비어 있는 문의 코드를 먼저 보정합니다.
update agency_inquiries ai
set tour_code = existing.case_code
from (
  select agency_inquiry_id, min(case_code) as case_code
  from quote_cases
  where agency_inquiry_id is not null
  group by agency_inquiry_id
) existing
where ai.id = existing.agency_inquiry_id
  and (ai.tour_code is null or btrim(ai.tour_code) = '');

create unique index if not exists quote_cases_agency_inquiry_uidx
  on quote_cases(agency_inquiry_id)
  where agency_inquiry_id is not null;

create unique index if not exists reservations_quote_case_uidx
  on reservations(quote_case_id);

create or replace function enforce_quote_case_workflow_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inquiry_row agency_inquiries%rowtype;
begin
  if new.agency_inquiry_id is null then
    return new;
  end if;

  select * into inquiry_row
  from agency_inquiries
  where id = new.agency_inquiry_id;

  if not found then
    raise exception 'Agency inquiry not found';
  end if;
  if inquiry_row.agency_account_id <> new.agency_account_id then
    raise exception 'Quote case agency does not match inquiry agency';
  end if;
  if inquiry_row.tour_code is null or btrim(inquiry_row.tour_code) = '' then
    raise exception 'Agency inquiry does not have a workflow code';
  end if;

  new.case_code := inquiry_row.tour_code;
  return new;
end;
$$;

drop trigger if exists quote_cases_enforce_workflow_code on quote_cases;
create trigger quote_cases_enforce_workflow_code
  before insert or update of agency_inquiry_id, agency_account_id, case_code on quote_cases
  for each row execute function enforce_quote_case_workflow_code();

create or replace function enforce_reservation_workflow_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row quote_cases%rowtype;
  accepted_case_id uuid;
begin
  select * into quote_row from quote_cases where id = new.quote_case_id;
  if not found then
    raise exception 'Quote case not found';
  end if;

  if new.accepted_quote_version_id is not null then
    select quote_case_id into accepted_case_id
    from quote_versions
    where id = new.accepted_quote_version_id and status = 'accepted';
    if accepted_case_id is null or accepted_case_id <> new.quote_case_id then
      raise exception 'Accepted quote version does not belong to reservation quote case';
    end if;
  end if;

  new.reservation_code := quote_row.case_code;
  new.agency_account_id := quote_row.agency_account_id;
  return new;
end;
$$;

drop trigger if exists reservations_enforce_workflow_code on reservations;
create trigger reservations_enforce_workflow_code
  before insert or update of quote_case_id, accepted_quote_version_id, reservation_code, agency_account_id on reservations
  for each row execute function enforce_reservation_workflow_code();

create or replace function sync_accepted_quote_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row quote_cases%rowtype;
  reservation_id_value uuid;
  actor_profile_id uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select * into quote_row from quote_cases where id = new.quote_case_id for update;
  if not found then
    raise exception 'Quote case not found';
  end if;

  if new.status = 'accepted' then
    update quote_cases set status = 'accepted' where id = quote_row.id;

    insert into reservations (
      quote_case_id,
      accepted_quote_version_id,
      reservation_code,
      agency_account_id,
      status,
      tour_start_date,
      tour_end_date
    ) values (
      quote_row.id,
      new.id,
      quote_row.case_code,
      quote_row.agency_account_id,
      'requested',
      quote_row.start_date,
      quote_row.end_date
    )
    on conflict (quote_case_id) do update
      set accepted_quote_version_id = excluded.accepted_quote_version_id,
          updated_at = now()
    returning id into reservation_id_value;

    select id into actor_profile_id from profiles where id = auth.uid();
    if not exists (
      select 1 from reservation_status_history
      where reservation_id = reservation_id_value and to_status = 'requested'
    ) then
      insert into reservation_status_history (
        reservation_id, from_status, to_status, reason, changed_by
      ) values (
        reservation_id_value, null, 'requested', 'Automatically created from accepted quote', actor_profile_id
      );
    end if;

    update workflow_threads
      set quote_case_id = quote_row.id,
          reservation_id = reservation_id_value,
          updated_by = actor_profile_id,
          updated_at = now()
      where workflow_code = quote_row.case_code;
  elsif new.status = 'sent' then
    update quote_cases set status = 'sent' where id = quote_row.id;
  end if;

  return new;
end;
$$;

drop trigger if exists quote_versions_sync_accepted_workflow on quote_versions;
create trigger quote_versions_sync_accepted_workflow
  after update of status on quote_versions
  for each row execute function sync_accepted_quote_workflow();

create or replace function enforce_invoice_workflow_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_code text;
begin
  select qc.case_code into canonical_code
  from reservations r
  join quote_cases qc on qc.id = r.quote_case_id
  where r.id = new.reservation_id;

  if canonical_code is null then
    raise exception 'Invoice reservation does not have a workflow code';
  end if;

  new.tour_code := canonical_code;
  new.invoice_no := canonical_code || '-INV-V' || lpad(new.version_no::text, 2, '0');
  return new;
end;
$$;

drop trigger if exists invoices_enforce_workflow_code on invoices;
create trigger invoices_enforce_workflow_code
  before insert or update of reservation_id, tour_code, invoice_no, version_no on invoices
  for each row execute function enforce_invoice_workflow_code();

create or replace function enforce_guide_report_workflow_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_code text;
begin
  select qc.case_code into canonical_code
  from reservations r
  join quote_cases qc on qc.id = r.quote_case_id
  where r.id = new.reservation_id;

  if canonical_code is null then
    raise exception 'Guide expense report reservation does not have a workflow code';
  end if;
  new.report_no := canonical_code;
  return new;
end;
$$;

drop trigger if exists guide_reports_enforce_workflow_code on guide_expense_reports;
create trigger guide_reports_enforce_workflow_code
  before insert or update of reservation_id, report_no on guide_expense_reports
  for each row execute function enforce_guide_report_workflow_code();

-- 라인 교체를 한 DB 트랜잭션에서 실행해 새 라인 저장 실패 시 기존 라인이 함께 복구되게 합니다.
create or replace function replace_guide_expense_report_lines(
  p_report_id uuid,
  p_reservation_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from guide_expense_reports
    where id = p_report_id and reservation_id = p_reservation_id
  ) then
    raise exception 'Guide expense report not found';
  end if;

  delete from guide_expense_report_lines where report_id = p_report_id;

  insert into guide_expense_report_lines (
    report_id, reservation_id, line_no, section, expense_date, day_no,
    vendor_name, description, unit_amount, quantity, pax_count, total_amount,
    payment_method, receipt_storage_path, notes, source_sheet_name, source_sheet_row
  )
  select
    p_report_id, p_reservation_id, row.line_no, row.section, row.expense_date,
    row.day_no, row.vendor_name, row.description, row.unit_amount, row.quantity,
    row.pax_count, row.total_amount, row.payment_method, row.receipt_storage_path,
    row.notes, row.source_sheet_name, row.source_sheet_row
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as row(
    line_no integer,
    section text,
    expense_date date,
    day_no integer,
    vendor_name text,
    description text,
    unit_amount numeric,
    quantity numeric,
    pax_count integer,
    total_amount numeric,
    payment_method text,
    receipt_storage_path text,
    notes text,
    source_sheet_name text,
    source_sheet_row integer
  );
end;
$$;

grant execute on function replace_guide_expense_report_lines(uuid, uuid, jsonb) to authenticated, service_role;

-- 메시지, 스레드 상태, 선택적 후속 액션을 한 번에 저장합니다.
create or replace function append_workflow_message(
  p_thread_id uuid,
  p_sender_type text,
  p_sender_profile_id uuid,
  p_sender_agency_user_id uuid,
  p_sender_name text,
  p_sender_email text,
  p_message_type text,
  p_body text,
  p_visibility text,
  p_next_status text,
  p_action_title text,
  p_action_category text,
  p_action_details text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  message_row workflow_messages%rowtype;
  action_row workflow_action_items%rowtype;
begin
  insert into workflow_messages (
    workflow_thread_id, sender_type, sender_profile_id, sender_agency_user_id,
    sender_name, sender_email, message_type, body, visibility, created_by
  ) values (
    p_thread_id, p_sender_type, p_sender_profile_id, p_sender_agency_user_id,
    p_sender_name, p_sender_email, p_message_type, p_body, p_visibility, p_sender_profile_id
  ) returning * into message_row;

  update workflow_threads
    set status = p_next_status,
        last_message_at = message_row.created_at,
        updated_by = p_sender_profile_id
    where id = p_thread_id;
  if not found then raise exception 'Workflow thread not found'; end if;

  if p_action_title is not null and btrim(p_action_title) <> '' then
    insert into workflow_action_items (
      workflow_thread_id, source_message_id, category, title, details, status,
      partner_visible, created_by, updated_by
    ) values (
      p_thread_id, message_row.id, p_action_category, p_action_title, p_action_details,
      'open', p_visibility = 'partner_visible', p_sender_profile_id, p_sender_profile_id
    ) returning * into action_row;
  end if;

  return jsonb_build_object(
    'message', to_jsonb(message_row),
    'actionItem', case when action_row.id is null then null else to_jsonb(action_row) end
  );
end;
$$;

grant execute on function append_workflow_message(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text)
  to authenticated, service_role;

-- 파트너가 작성한 메시지에 딸린 후속 액션만 같은 파트너 계정 범위에서 생성할 수 있습니다.
drop policy if exists "workflow action items agency insert" on workflow_action_items;
create policy "workflow action items agency insert"
  on workflow_action_items
  for insert
  with check (
    partner_visible = true
    and created_by is null
    and updated_by is null
    and source_message_id is not null
    and exists (
      select 1
      from workflow_messages wm
      join workflow_threads wt on wt.id = wm.workflow_thread_id
      join agency_users au on au.id = wm.sender_agency_user_id
      where wm.id = workflow_action_items.source_message_id
        and wm.workflow_thread_id = workflow_action_items.workflow_thread_id
        and wm.sender_type = 'agency'
        and wm.visibility = 'partner_visible'
        and au.auth_user_id = auth.uid()
        and wt.agency_account_id = au.agency_account_id
        and is_agency_member(wt.agency_account_id)
    )
  );

-- 파트너 문의는 문의 원장, workflow thread, 첫 메시지, 감사 로그가 항상 함께 존재해야 합니다.
-- SECURITY DEFINER 함수 안에서 현재 로그인한 agency user를 다시 검증한 뒤 한 트랜잭션으로 저장합니다.

alter table agency_inquiries
  add column if not exists idempotency_key text;

create unique index if not exists agency_inquiries_agency_idempotency_uidx
  on agency_inquiries(agency_account_id, idempotency_key)
  where idempotency_key is not null;

create or replace function submit_agency_inquiry_atomic(
  p_agency_account_id uuid,
  p_agency_user_id uuid,
  p_inquiry_type text,
  p_title text,
  p_tour_code text,
  p_arrival_date date,
  p_departure_date date,
  p_period_text text,
  p_nights_count integer,
  p_flight_details jsonb,
  p_pax_count integer,
  p_preferred_language text,
  p_tour_type text,
  p_request_payload jsonb,
  p_message_body text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  agency_user_row agency_users%rowtype;
  inquiry_row agency_inquiries%rowtype;
  thread_row workflow_threads%rowtype;
  message_row workflow_messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into agency_user_row
  from agency_users
  where id = p_agency_user_id
    and agency_account_id = p_agency_account_id
    and auth_user_id = auth.uid()
    and status = 'active';
  if not found then
    raise exception 'Active agency user is required' using errcode = '42501';
  end if;

  if p_inquiry_type not in (
    'new_inquiry', 'revision_request', 'booking_request', 'change_request',
    'cancellation_request', 'existing_product_inquiry'
  ) then
    raise exception 'Unsupported inquiryType' using errcode = '22023';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if p_tour_code is null or btrim(p_tour_code) = '' then
    raise exception 'tourCode is required' using errcode = '22023';
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into inquiry_row
    from agency_inquiries
    where agency_account_id = p_agency_account_id
      and idempotency_key = btrim(p_idempotency_key);
    if found then
      return jsonb_build_object('inquiry', to_jsonb(inquiry_row), 'existing', true);
    end if;
  end if;

  select * into thread_row
  from workflow_threads
  where workflow_code = p_tour_code;
  if found and thread_row.agency_account_id <> p_agency_account_id then
    raise exception 'Workflow does not belong to this agency' using errcode = '42501';
  end if;

  insert into agency_inquiries (
    agency_account_id, submitted_by_agency_user_id, inquiry_type, title, tour_code,
    arrival_date, departure_date, period_text, nights_count, flight_details,
    requested_start_date, requested_end_date, pax_count, preferred_language, tour_type,
    source_channel, request_payload, idempotency_key
  ) values (
    p_agency_account_id, p_agency_user_id, p_inquiry_type::agency_inquiry_type,
    btrim(p_title), btrim(p_tour_code), p_arrival_date, p_departure_date, p_period_text,
    p_nights_count, coalesce(p_flight_details, '[]'::jsonb), p_arrival_date, p_departure_date,
    p_pax_count, p_preferred_language,
    case when p_tour_type is null or btrim(p_tour_type) = '' then null else p_tour_type::tour_type end,
    'portal', coalesce(p_request_payload, '{}'::jsonb), nullif(btrim(p_idempotency_key), '')
  ) returning * into inquiry_row;

  if thread_row.id is null then
    insert into workflow_threads (
      workflow_code, agency_account_id, agency_inquiry_id, title, status
    ) values (
      btrim(p_tour_code), p_agency_account_id, inquiry_row.id, btrim(p_title), 'waiting_internal'
    ) returning * into thread_row;
  end if;

  insert into workflow_messages (
    workflow_thread_id, sender_type, sender_agency_user_id, sender_name, sender_email,
    message_type, body, visibility, metadata
  ) values (
    thread_row.id, 'agency', p_agency_user_id, agency_user_row.name, agency_user_row.email,
    case
      when p_inquiry_type = 'new_inquiry' then 'new_inquiry'
      when p_inquiry_type = 'cancellation_request' then 'cancellation'
      else 'quote_revision'
    end,
    p_message_body, 'partner_visible', jsonb_build_object('agency_inquiry_id', inquiry_row.id)
  ) returning * into message_row;

  update workflow_threads
  set status = 'waiting_internal',
      last_message_at = message_row.created_at,
      updated_at = now()
  where id = thread_row.id;

  insert into audit_logs (
    actor_profile_id, action, entity_table, entity_id, after_data
  ) values (
    null, 'agency_inquiry.submitted', 'agency_inquiries', inquiry_row.id,
    jsonb_build_object(
      'agencyAccountId', p_agency_account_id,
      'agencyUserId', p_agency_user_id,
      'inquiry', to_jsonb(inquiry_row)
    )
  );

  return jsonb_build_object('inquiry', to_jsonb(inquiry_row), 'existing', false);
exception
  when unique_violation then
    if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
      raise;
    end if;
    select * into inquiry_row
    from agency_inquiries
    where agency_account_id = p_agency_account_id
      and idempotency_key = btrim(p_idempotency_key);
    if inquiry_row.id is null then raise; end if;
    return jsonb_build_object('inquiry', to_jsonb(inquiry_row), 'existing', true);
end;
$$;

revoke all on function submit_agency_inquiry_atomic(
  uuid, uuid, text, text, text, date, date, text, integer, jsonb, integer,
  text, text, jsonb, text, text
) from public;

grant execute on function submit_agency_inquiry_atomic(
  uuid, uuid, text, text, text, date, date, text, integer, jsonb, integer,
  text, text, jsonb, text, text
) to authenticated;

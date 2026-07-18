-- Partner revision requests may only move quote cases that are still in the
-- quotation lifecycle. Accepted, cancelled, and expired cases must continue
-- through reservation change/cancellation workflows instead of being reopened.
create or replace function public.submit_agency_quote_request_atomic(
  p_agency_account_id uuid,
  p_agency_user_id uuid,
  p_quote_case_id uuid,
  p_inquiry_type text,
  p_title text,
  p_message text,
  p_requested_changes jsonb,
  p_quote_version_id uuid,
  p_agency_reference_no text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote_row public.quote_cases%rowtype;
  version_row public.quote_versions%rowtype;
  inquiry_row public.agency_inquiries%rowtype;
  request_payload jsonb;
  request_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform 1
  from public.agency_users
  where id = p_agency_user_id
    and agency_account_id = p_agency_account_id
    and auth_user_id = auth.uid()
    and status = 'active';
  if not found then
    raise exception 'Active agency user is required' using errcode = '42501';
  end if;

  if p_inquiry_type not in ('booking_request', 'revision_request') then
    raise exception 'Unsupported quote request type' using errcode = '22023';
  end if;
  if p_message is null or btrim(p_message) = '' then
    raise exception 'message is required' using errcode = '22023';
  end if;

  select * into quote_row
  from public.quote_cases
  where id = p_quote_case_id
    and agency_account_id = p_agency_account_id
  for update;
  if not found then
    raise exception 'Quote case not found' using errcode = 'P0002';
  end if;

  -- An exact idempotent replay is safe even if the quote moved to a later
  -- lifecycle state after the original request. It returns the original row
  -- and never applies a second status transition.
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into inquiry_row
    from public.agency_inquiries
    where agency_account_id = p_agency_account_id
      and idempotency_key = btrim(p_idempotency_key);
    if found then
      if inquiry_row.related_quote_case_id <> p_quote_case_id
         or inquiry_row.inquiry_type::text <> p_inquiry_type then
        raise exception 'Idempotency key was already used for another request' using errcode = '23505';
      end if;
      return jsonb_build_object('inquiry', to_jsonb(inquiry_row), 'existing', true);
    end if;
  end if;

  if p_inquiry_type = 'booking_request' then
    if quote_row.status::text not in ('sent', 'accepted') then
      raise exception 'Booking request is not allowed for quote status %', quote_row.status
        using errcode = '23514';
    end if;

    select * into version_row
    from public.quote_versions
    where quote_case_id = quote_row.id
      and status::text in ('sent', 'accepted')
      and (p_quote_version_id is null or id = p_quote_version_id)
    order by version_no desc
    limit 1;
    if not found then
      raise exception 'Booking request requires a sent or accepted quote version' using errcode = '22023';
    end if;

    request_title := 'Booking request: ' || quote_row.tour_name;
    request_payload := jsonb_build_object(
      'message', btrim(p_message),
      'requested_quote_version_id', version_row.id,
      'requested_quote_version_no', version_row.version_no,
      'requested_quote_version_status', version_row.status,
      'agency_reference_no', nullif(btrim(p_agency_reference_no), '')
    );
  else
    if quote_row.status::text not in ('quoting', 'sent', 'revision_requested') then
      raise exception 'Revision request is not allowed for quote status %', quote_row.status
        using errcode = '23514';
    end if;

    request_title := coalesce(nullif(btrim(p_title), ''), 'Revision request: ' || quote_row.tour_name);
    request_payload := jsonb_build_object(
      'message', btrim(p_message),
      'requested_changes', coalesce(p_requested_changes, '[]'::jsonb)
    );
  end if;

  insert into public.agency_inquiries (
    agency_account_id, submitted_by_agency_user_id, inquiry_type, title,
    source_channel, related_quote_case_id, request_payload, idempotency_key
  ) values (
    p_agency_account_id, p_agency_user_id, p_inquiry_type::public.agency_inquiry_type,
    request_title, 'portal', quote_row.id, request_payload,
    nullif(btrim(p_idempotency_key), '')
  ) returning * into inquiry_row;

  if p_inquiry_type = 'revision_request' then
    update public.quote_cases
    set status = 'revision_requested'
    where id = quote_row.id;
  end if;

  insert into public.audit_logs (
    actor_profile_id, action, entity_table, entity_id, before_data, after_data
  ) values (
    null,
    case when p_inquiry_type = 'booking_request'
      then 'agency_quote.booking_requested'
      else 'agency_quote.revision_requested'
    end,
    'agency_inquiries', inquiry_row.id,
    case when p_inquiry_type = 'revision_request'
      then jsonb_build_object('quoteCaseStatus', quote_row.status)
      else null
    end,
    jsonb_build_object(
      'agencyAccountId', p_agency_account_id,
      'agencyUserId', p_agency_user_id,
      'quoteCaseId', quote_row.id,
      'quoteCaseStatus', case when p_inquiry_type = 'revision_request' then 'revision_requested' else quote_row.status::text end,
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
    from public.agency_inquiries
    where agency_account_id = p_agency_account_id
      and idempotency_key = btrim(p_idempotency_key);
    if inquiry_row.id is null
       or inquiry_row.related_quote_case_id <> p_quote_case_id
       or inquiry_row.inquiry_type::text <> p_inquiry_type then
      raise;
    end if;
    return jsonb_build_object('inquiry', to_jsonb(inquiry_row), 'existing', true);
end;
$$;

revoke all on function public.submit_agency_quote_request_atomic(
  uuid, uuid, uuid, text, text, text, jsonb, uuid, text, text
) from public, anon;
grant execute on function public.submit_agency_quote_request_atomic(
  uuid, uuid, uuid, text, text, text, jsonb, uuid, text, text
) to authenticated, service_role;

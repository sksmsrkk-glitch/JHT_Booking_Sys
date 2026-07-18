-- @file 한글 책임: Supabase 마이그레이션 `atomic writes idempotency`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

-- 대량 업로드와 인보이스 발행은 여러 테이블을 동시에 변경합니다.
-- 네트워크 재시도나 중간 오류에도 부분 데이터와 중복 버전이 남지 않도록
-- DB 트랜잭션 경계와 멱등성 키를 함께 적용합니다.

alter table migration_batches
  add column if not exists idempotency_key text;

create unique index if not exists migration_batches_idempotency_uidx
  on migration_batches(idempotency_key)
  where idempotency_key is not null;

alter table invoices
  add column if not exists idempotency_key text;

create unique index if not exists invoices_idempotency_uidx
  on invoices(idempotency_key)
  where idempotency_key is not null;

-- CSV 배치와 모든 staging 행, 감사 로그를 하나의 트랜잭션으로 기록합니다.
create or replace function stage_notion_csv_batch_atomic(
  p_source_name text,
  p_target_table text,
  p_rows jsonb,
  p_uploaded_by uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  batch_row migration_batches%rowtype;
  row_count integer;
begin
  if not has_internal_role() then
    raise exception 'Internal role is required' using errcode = '42501';
  end if;
  if p_source_name is null or btrim(p_source_name) = '' then
    raise exception 'sourceName is required' using errcode = '22023';
  end if;
  if p_target_table not in (
    'agency_accounts', 'agency_contacts', 'domestic_suppliers',
    'supplier_contacts', 'supplier_products', 'supplier_prices', 'supplier_media'
  ) then
    raise exception 'Unsupported targetTable for Notion CSV staging' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'rows must be a non-empty array' using errcode = '22023';
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into batch_row
    from migration_batches
    where idempotency_key = btrim(p_idempotency_key);
    if found then
      select count(*)::integer into row_count
      from staging_rows
      where migration_batch_id = batch_row.id;
      return jsonb_build_object(
        'batch', to_jsonb(batch_row),
        'rowCount', row_count,
        'existing', true
      );
    end if;
  end if;

  insert into migration_batches (
    source_name, source_kind, target_table, status, uploaded_by, idempotency_key
  ) values (
    btrim(p_source_name), 'notion_csv', p_target_table, 'uploaded', p_uploaded_by,
    nullif(btrim(p_idempotency_key), '')
  ) returning * into batch_row;

  insert into staging_rows (
    migration_batch_id, row_no, raw_payload, mapped_payload, validation_status
  )
  select batch_row.id, source_row.ordinality::integer, source_row.payload, '{}'::jsonb, 'pending'
  from jsonb_array_elements(p_rows) with ordinality as source_row(payload, ordinality);

  row_count := jsonb_array_length(p_rows);
  insert into audit_logs (
    actor_profile_id, action, entity_table, entity_id, after_data
  ) values (
    p_uploaded_by, 'notion_csv.staged', 'migration_batches', batch_row.id,
    jsonb_build_object('targetTable', p_target_table, 'rowCount', row_count)
  );

  return jsonb_build_object(
    'batch', to_jsonb(batch_row),
    'rowCount', row_count,
    'existing', false
  );
exception
  when unique_violation then
    if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
      raise;
    end if;
    select * into batch_row
    from migration_batches
    where idempotency_key = btrim(p_idempotency_key);
    select count(*)::integer into row_count
    from staging_rows
    where migration_batch_id = batch_row.id;
    return jsonb_build_object(
      'batch', to_jsonb(batch_row),
      'rowCount', row_count,
      'existing', true
    );
end;
$$;

grant execute on function stage_notion_csv_batch_atomic(text, text, jsonb, uuid, text)
  to authenticated, service_role;

-- 메시지 본문과 inquiry 연결 metadata, 스레드 상태, 선택적 action item을 원자적으로 저장합니다.
create or replace function append_workflow_message_v2(
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
  p_metadata jsonb,
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
    sender_name, sender_email, message_type, body, visibility, metadata, created_by
  ) values (
    p_thread_id, p_sender_type, p_sender_profile_id, p_sender_agency_user_id,
    p_sender_name, p_sender_email, p_message_type, p_body, p_visibility,
    coalesce(p_metadata, '{}'::jsonb), p_sender_profile_id
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

grant execute on function append_workflow_message_v2(
  uuid, text, uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text
) to authenticated, service_role;

-- 인보이스 버전 할당, 라인 저장, workflow 연결, 감사 로그를 직렬화된 한 트랜잭션으로 처리합니다.
create or replace function create_invoice_version_atomic(
  p_reservation_id uuid,
  p_status text,
  p_currency text,
  p_total_amount numeric,
  p_due_date date,
  p_payment_deadline date,
  p_collection_timing text,
  p_collection_status text,
  p_deposit_required boolean,
  p_deposit_amount numeric,
  p_storage_path text,
  p_bank_account_snapshot jsonb,
  p_flight_details jsonb,
  p_itinerary_snapshot jsonb,
  p_invoice_payload jsonb,
  p_line_items jsonb,
  p_actor_profile_id uuid,
  p_idempotency_key text default null,
  p_requested_version integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  reservation_row reservations%rowtype;
  quote_case_code text;
  invoice_row invoices%rowtype;
  previous_row invoices%rowtype;
  next_version integer;
  line_total numeric;
begin
  if not has_finance_role() then
    raise exception 'Finance role is required' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'issued') then
    raise exception 'Invoice status must be draft or issued' using errcode = '22023';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Invoice total amount must be greater than zero' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_line_items, '[]'::jsonb)) <> 'array' then
    raise exception 'lineItems must be an array' using errcode = '22023';
  end if;

  -- 같은 예약의 동시 발행 요청을 직렬화하여 version_no 경쟁을 제거합니다.
  perform pg_advisory_xact_lock(hashtextextended(p_reservation_id::text, 0));

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into invoice_row
    from invoices
    where idempotency_key = btrim(p_idempotency_key);
    if found then
      return jsonb_build_object(
        'invoice', to_jsonb(invoice_row),
        'previousInvoice', null,
        'existing', true
      );
    end if;
  end if;

  select * into reservation_row
  from reservations
  where id = p_reservation_id
  for update;
  if not found then raise exception 'Reservation not found' using errcode = 'P0002'; end if;
  if reservation_row.status = 'cancelled' then
    raise exception 'Cancelled reservation cannot be invoiced' using errcode = '23514';
  end if;
  if reservation_row.accepted_quote_version_id is null or not exists (
    select 1 from quote_versions
    where id = reservation_row.accepted_quote_version_id and status = 'accepted'
  ) then
    raise exception 'Reservation must have an accepted quote version before invoice creation' using errcode = '23514';
  end if;
  if exists (
    select 1 from settlements
    where reservation_id = p_reservation_id and status = 'closed'
  ) then
    raise exception 'Finance entries cannot be added after settlement is closed' using errcode = '23514';
  end if;

  select case_code into quote_case_code
  from quote_cases
  where id = reservation_row.quote_case_id;
  quote_case_code := coalesce(nullif(quote_case_code, ''), reservation_row.reservation_code);

  select * into previous_row
  from invoices
  where tour_code = quote_case_code
  order by version_no desc
  limit 1;

  next_version := coalesce(p_requested_version, coalesce(previous_row.version_no, 0) + 1);
  if next_version < 1 then
    raise exception 'versionNo must be positive' using errcode = '22023';
  end if;

  select coalesce(sum((item->>'total_amount')::numeric), 0)
  into line_total
  from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) as item;
  if jsonb_array_length(coalesce(p_line_items, '[]'::jsonb)) > 0
     and abs(line_total - p_total_amount) > 0.01 then
    raise exception 'Invoice line total does not match invoice total' using errcode = '23514';
  end if;

  insert into invoices (
    reservation_id, invoice_no, tour_code, version_no, status, currency, total_amount,
    issued_at, due_date, payment_deadline, collection_timing, collection_status,
    deposit_required, deposit_amount, storage_path, bank_account_snapshot,
    flight_details, itinerary_snapshot, invoice_payload, idempotency_key
  ) values (
    p_reservation_id, quote_case_code || '-INV-V' || lpad(next_version::text, 2, '0'),
    quote_case_code, next_version, p_status::invoice_status, p_currency, p_total_amount,
    case when p_status = 'issued' then now() else null end, p_due_date, p_payment_deadline,
    p_collection_timing, coalesce(p_collection_status, 'unpaid'), coalesce(p_deposit_required, false),
    p_deposit_amount, p_storage_path, coalesce(p_bank_account_snapshot, '{}'::jsonb),
    coalesce(p_flight_details, '[]'::jsonb), coalesce(p_itinerary_snapshot, '[]'::jsonb),
    coalesce(p_invoice_payload, '{}'::jsonb), nullif(btrim(p_idempotency_key), '')
  ) returning * into invoice_row;

  insert into invoice_line_items (
    invoice_id, line_no, description, service_date, category, currency,
    unit_amount, quantity, unit_label, total_amount, notes, metadata
  )
  select
    invoice_row.id,
    coalesce((item->>'line_no')::integer, ordinality::integer),
    item->>'description', nullif(item->>'service_date', '')::date, item->>'category',
    coalesce(nullif(item->>'currency', ''), p_currency),
    coalesce((item->>'unit_amount')::numeric, 0),
    coalesce((item->>'quantity')::numeric, 1),
    item->>'unit_label', coalesce((item->>'total_amount')::numeric, 0),
    item->>'notes', coalesce(item->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) with ordinality as source(item, ordinality);

  update workflow_threads
  set current_invoice_id = invoice_row.id,
      updated_by = p_actor_profile_id
  where workflow_code = quote_case_code;

  insert into audit_logs (
    actor_profile_id, action, entity_table, entity_id, risk_level, after_data
  ) values (
    p_actor_profile_id,
    case when p_status = 'issued' then 'invoice.issued' else 'invoice.created' end,
    'invoices', invoice_row.id,
    case when p_status = 'issued' then 'high'::risk_level else 'normal'::risk_level end,
    jsonb_build_object(
      'invoice', to_jsonb(invoice_row),
      'lineItemCount', jsonb_array_length(coalesce(p_line_items, '[]'::jsonb)),
      'previousInvoiceId', previous_row.id,
      'reservationId', p_reservation_id,
      'acceptedQuoteVersionId', reservation_row.accepted_quote_version_id
    )
  );

  return jsonb_build_object(
    'invoice', to_jsonb(invoice_row),
    'previousInvoice', case when previous_row.id is null then null else to_jsonb(previous_row) end,
    'existing', false
  );
exception
  when unique_violation then
    if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
      raise;
    end if;
    select * into invoice_row
    from invoices
    where idempotency_key = btrim(p_idempotency_key);
    if invoice_row.id is null then raise; end if;
    return jsonb_build_object(
      'invoice', to_jsonb(invoice_row),
      'previousInvoice', null,
      'existing', true
    );
end;
$$;

grant execute on function create_invoice_version_atomic(
  uuid, text, text, numeric, date, date, text, text, boolean, numeric, text,
  jsonb, jsonb, jsonb, jsonb, jsonb, uuid, text, integer
) to authenticated, service_role;

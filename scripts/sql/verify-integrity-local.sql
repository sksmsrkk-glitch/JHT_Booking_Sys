begin;

do $$
begin
  if has_function_privilege('anon', 'public.refresh_reservation_operation_readiness(uuid)', 'EXECUTE') then
    raise exception 'anon can execute refresh_reservation_operation_readiness';
  end if;
  if has_function_privilege('authenticated', 'public.refresh_reservation_operation_readiness(uuid)', 'EXECUTE') then
    raise exception 'authenticated can execute refresh_reservation_operation_readiness';
  end if;
  if not has_function_privilege('service_role', 'public.refresh_reservation_operation_readiness(uuid)', 'EXECUTE') then
    raise exception 'service_role cannot execute refresh_reservation_operation_readiness';
  end if;
end;
$$;

-- Force the audit insert to fail and prove that the inquiry insert is rolled back with it.
create function public.jht_test_force_quote_audit_failure()
returns trigger
language plpgsql
as $$
begin
  if new.action = 'agency_quote.booking_requested' then
    raise exception 'JHT_TEST_FORCED_AUDIT_FAILURE';
  end if;
  return new;
end;
$$;

create trigger jht_test_force_quote_audit_failure
before insert on public.audit_logs
for each row execute function public.jht_test_force_quote_audit_failure();

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);

do $$
begin
  begin
    perform public.submit_agency_quote_request_atomic(
      '00000000-0000-4000-8000-000000003001',
      '00000000-0000-4000-8000-000000003101',
      '00000000-0000-4000-8000-000000008001',
      'booking_request',
      null,
      'Atomic rollback verification',
      '[]'::jsonb,
      '00000000-0000-4000-8000-000000008101',
      null,
      'integrity-forced-audit-failure'
    );
    raise exception 'Expected forced audit failure did not occur';
  exception
    when others then
      if position('JHT_TEST_FORCED_AUDIT_FAILURE' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.agency_inquiries
    where idempotency_key = 'integrity-forced-audit-failure'
  ) then
    raise exception 'Inquiry survived a failed atomic audit insert';
  end if;
end;
$$;

drop trigger jht_test_force_quote_audit_failure on public.audit_logs;
drop function public.jht_test_force_quote_audit_failure();

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);

do $$
declare
  first_booking jsonb;
  replay_booking jsonb;
begin
  first_booking := public.submit_agency_quote_request_atomic(
    '00000000-0000-4000-8000-000000003001',
    '00000000-0000-4000-8000-000000003101',
    '00000000-0000-4000-8000-000000008001',
    'booking_request',
    null,
    'Booking request integrity verification',
    '[]'::jsonb,
    '00000000-0000-4000-8000-000000008101',
    'INTEGRITY-BOOKING',
    'integrity-booking-success'
  );
  replay_booking := public.submit_agency_quote_request_atomic(
    '00000000-0000-4000-8000-000000003001',
    '00000000-0000-4000-8000-000000003101',
    '00000000-0000-4000-8000-000000008001',
    'booking_request',
    null,
    'Booking request integrity verification',
    '[]'::jsonb,
    '00000000-0000-4000-8000-000000008101',
    'INTEGRITY-BOOKING',
    'integrity-booking-success'
  );

  if coalesce((first_booking ->> 'existing')::boolean, true) then
    raise exception 'First booking request was incorrectly treated as replay';
  end if;
  if not coalesce((replay_booking ->> 'existing')::boolean, false) then
    raise exception 'Booking request replay was not detected';
  end if;
  if first_booking #>> '{inquiry,id}' <> replay_booking #>> '{inquiry,id}' then
    raise exception 'Booking request replay returned a different inquiry';
  end if;

  perform public.submit_agency_quote_request_atomic(
    '00000000-0000-4000-8000-000000003001',
    '00000000-0000-4000-8000-000000003101',
    '00000000-0000-4000-8000-000000008001',
    'revision_request',
    'Revision request integrity verification',
    'Move one hotel night to Busan',
    '["Move one hotel night to Busan"]'::jsonb,
    null,
    null,
    'integrity-revision-success'
  );
end;
$$;

reset role;

do $$
begin
  if (select status::text from public.quote_cases where id = '00000000-0000-4000-8000-000000008001') <> 'revision_requested' then
    raise exception 'Revision request did not transition quote status';
  end if;
  if (select count(*) from public.agency_inquiries where idempotency_key = 'integrity-booking-success') <> 1 then
    raise exception 'Booking request idempotency created duplicate inquiries';
  end if;
  if (select count(*) from public.audit_logs where action = 'agency_quote.booking_requested' and after_data ->> 'quoteCaseId' = '00000000-0000-4000-8000-000000008001') < 1 then
    raise exception 'Booking request audit log was not written';
  end if;
  if (select count(*) from public.audit_logs where action = 'agency_quote.revision_requested' and after_data ->> 'quoteCaseId' = '00000000-0000-4000-8000-000000008001') < 1 then
    raise exception 'Revision request audit log was not written';
  end if;
end;
$$;

-- The same payment key must be reusable on another invoice without replaying the first payment.
do $$
declare
  second_invoice_id uuid := gen_random_uuid();
begin
  insert into public.invoices (
    id, reservation_id, invoice_no, version_no, status, currency, total_amount
  ) values (
    second_invoice_id,
    '00000000-0000-4000-8000-000000009001',
    'placeholder',
    2,
    'issued',
    'KRW',
    1000
  );

  insert into public.payments (
    invoice_id, status, currency, amount, idempotency_key
  ) values (
    second_invoice_id,
    'confirmed',
    'KRW',
    1000,
    'demo-payment-inv-2026-001-1'
  );

  if (select count(distinct invoice_id) from public.payments where idempotency_key = 'demo-payment-inv-2026-001-1') <> 2 then
    raise exception 'Payment idempotency key is still global instead of invoice-scoped';
  end if;
end;
$$;

-- Build 101 isolated reservations and invoices to prove the KPI does not stop at the first page.
create temporary table jht_test_kpi_reservations (
  id uuid primary key
) on commit drop;

with inserted_quotes as (
  insert into public.quote_cases (
    id, company_id, agency_account_id, case_code, share_id, tour_name,
    status, currency, start_date, end_date
  )
  select
    gen_random_uuid(),
    '00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000003001',
    'JHT-KPI-203501-' || lpad(series_no::text, 3, '0'),
    'jht-kpi-203501-' || lpad(series_no::text, 3, '0'),
    'KPI integrity group ' || series_no,
    'accepted',
    'KRW',
    date '2035-01-15',
    date '2035-01-16'
  from generate_series(1, 101) as series_no
  returning id
), inserted_reservations as (
  insert into public.reservations (
    id, quote_case_id, reservation_code, agency_account_id, status,
    tour_start_date, tour_end_date
  )
  select
    gen_random_uuid(),
    id,
    'placeholder',
    '00000000-0000-4000-8000-000000003001',
    'confirmed',
    date '2035-01-15',
    date '2035-01-16'
  from inserted_quotes
  returning id
)
insert into jht_test_kpi_reservations (id)
select id from inserted_reservations;

insert into public.invoices (
  id, reservation_id, invoice_no, version_no, status, currency, total_amount
)
select
  gen_random_uuid(),
  id,
  'placeholder-' || id,
  1,
  'issued',
  'KRW',
  100
from jht_test_kpi_reservations;

do $$
declare
  kpis jsonb;
begin
  kpis := public.get_admin_finance_kpis(
    null,
    '00000000-0000-4000-8000-000000003001',
    date '2035-01-01',
    date '2035-01-31'
  );
  if (kpis ->> 'receivableCount')::integer <> 101 then
    raise exception 'Expected 101 receivable groups, got %', kpis ->> 'receivableCount';
  end if;
  if (kpis ->> 'receivableAmount')::numeric <> 10100 then
    raise exception 'Expected receivable amount 10100, got %', kpis ->> 'receivableAmount';
  end if;
end;
$$;

-- Delivery evidence must prevent a failed message from being requeued.
do $$
begin
  update public.supplier_message_outbox
  set provider_message_id = 'integrity-provider:already-submitted'
  where id = '00000000-0000-4000-8000-000000009701';

  begin
    update public.supplier_message_outbox
    set status = 'queued'
    where id = '00000000-0000-4000-8000-000000009701';
    raise exception 'Supplier message with delivery evidence was requeued';
  exception
    when check_violation then null;
  end;

  if (select status::text from public.supplier_message_outbox where id = '00000000-0000-4000-8000-000000009701') <> 'failed' then
    raise exception 'Supplier message status changed despite requeue protection';
  end if;
end;
$$;

rollback;

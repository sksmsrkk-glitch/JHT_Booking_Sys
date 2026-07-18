-- Aggregate the complete dashboard scope in PostgreSQL. The dashboard must not
-- derive KPIs or breakdown rows from the first page of operational list data.
create or replace function public.get_admin_dashboard_analytics(
  p_country text default null,
  p_agency_account_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (jht_is_privileged_session() or has_internal_role()) then
    raise exception 'Internal role required' using errcode = '42501';
  end if;

  with agency_options as materialized (
    select aa.id, aa.name, coalesce(upper(aa.country_code), 'UNKNOWN') as country_code
    from agency_accounts aa
    where aa.status = 'active'
  ),
  agency_scope as materialized (
    select *
    from agency_options ao
    where (p_country is null or p_country = '' or ao.country_code = upper(p_country))
      and (p_agency_account_id is null or ao.id = p_agency_account_id)
  ),
  quote_scope as materialized (
    select
      qc.id,
      qc.agency_account_id,
      a.name as partner_name,
      a.country_code,
      qc.status::text as status,
      coalesce(qc.estimated_pax, 0)::bigint as estimated_pax,
      coalesce(qc.start_date, qc.created_at::date) as activity_date,
      exists (select 1 from reservations r0 where r0.quote_case_id = qc.id) as has_reservation
    from quote_cases qc
    join agency_scope a on a.id = qc.agency_account_id
    where (p_from is null or coalesce(qc.start_date, qc.created_at::date) >= p_from)
      and (p_to is null or coalesce(qc.start_date, qc.created_at::date) <= p_to)
  ),
  reservation_scope as materialized (
    select
      r.id,
      r.quote_case_id,
      r.agency_account_id,
      a.name as partner_name,
      a.country_code,
      r.status::text as status,
      coalesce(qc.estimated_pax, 0)::bigint as estimated_pax,
      coalesce(r.tour_start_date, r.tour_end_date, r.created_at::date) as activity_date
    from reservations r
    join agency_scope a on a.id = r.agency_account_id
    left join quote_cases qc on qc.id = r.quote_case_id
    where (p_from is null or coalesce(r.tour_start_date, r.tour_end_date, r.created_at::date) >= p_from)
      and (p_to is null or coalesce(r.tour_start_date, r.tour_end_date, r.created_at::date) <= p_to)
  ),
  inquiry_scope as materialized (
    select
      ai.id,
      ai.agency_account_id,
      a.name as partner_name,
      a.country_code,
      ai.status,
      ai.created_at::date as activity_date
    from agency_inquiries ai
    join agency_scope a on a.id = ai.agency_account_id
    where (p_from is null or ai.created_at::date >= p_from)
      and (p_to is null or ai.created_at::date <= p_to)
  ),
  latest_invoices as materialized (
    select distinct on (i.reservation_id)
      i.id,
      i.reservation_id,
      i.status::text as status,
      i.total_amount,
      rs.agency_account_id,
      rs.partner_name,
      rs.country_code,
      rs.activity_date
    from invoices i
    join reservation_scope rs on rs.id = i.reservation_id
    order by i.reservation_id, i.version_no desc, i.created_at desc
  ),
  confirmed_payments as materialized (
    select p.invoice_id, coalesce(sum(p.amount), 0) as paid_amount
    from payments p
    join latest_invoices li on li.id = p.invoice_id
    where p.status = 'confirmed'
    group by p.invoice_id
  ),
  invoice_scope as materialized (
    select
      li.*,
      case when li.status <> 'void'
        then greatest(li.total_amount - coalesce(cp.paid_amount, 0), 0)
        else 0
      end as receivable_amount
    from latest_invoices li
    left join confirmed_payments cp on cp.invoice_id = li.id
  ),
  settlement_scope as materialized (
    select
      s.id,
      s.status::text as status,
      rs.agency_account_id,
      rs.partner_name,
      rs.country_code,
      rs.activity_date
    from settlements s
    join reservation_scope rs on rs.id = s.reservation_id
  ),
  facts as materialized (
    select
      q.agency_account_id, q.partner_name, q.country_code,
      to_char(q.activity_date, 'YYYY-MM') as period_key,
      'quote:' || q.status as status_key,
      'Quote: ' || initcap(replace(q.status, '_', ' ')) as status_label,
      (case when q.status in ('new', 'triage', 'quoting', 'sent', 'revision_requested') then 1 else 0 end)::bigint as quote_inquiries,
      0::bigint as confirmed,
      (case when q.status = 'cancelled' and not q.has_reservation then 1 else 0 end)::bigint as cancelled,
      0::bigint as inquiries,
      1::bigint as quote_cases,
      (case when q.has_reservation then 0 else q.estimated_pax end)::bigint as pax,
      0::bigint as active_reservations,
      0::bigint as settlement_done,
      0::bigint as receivable_count,
      0::numeric as receivable_amount
    from quote_scope q

    union all

    select
      r.agency_account_id, r.partner_name, r.country_code,
      to_char(r.activity_date, 'YYYY-MM'),
      'reservation:' || r.status,
      'Reservation: ' || initcap(replace(r.status, '_', ' ')),
      0,
      (case when r.status in ('confirmed', 'on_tour', 'completed') then 1 else 0 end)::bigint,
      (case when r.status = 'cancelled' then 1 else 0 end)::bigint,
      0, 0, r.estimated_pax,
      (case when r.status not in ('cancelled', 'completed') then 1 else 0 end)::bigint,
      0, 0, 0::numeric
    from reservation_scope r

    union all

    select
      i.agency_account_id, i.partner_name, i.country_code,
      to_char(i.activity_date, 'YYYY-MM'),
      'inquiry:' || i.status,
      'Inquiry: ' || initcap(replace(i.status, '_', ' ')),
      0, 0, 0, 1, 0, 0, 0, 0, 0, 0::numeric
    from inquiry_scope i

    union all

    select
      i.agency_account_id, i.partner_name, i.country_code,
      to_char(i.activity_date, 'YYYY-MM'),
      'invoice:' || i.status,
      'Invoice: ' || initcap(replace(i.status, '_', ' ')),
      0, 0, 0, 0, 0, 0, 0, 0,
      (case when i.receivable_amount > 0 then 1 else 0 end)::bigint,
      i.receivable_amount
    from invoice_scope i

    union all

    select
      s.agency_account_id, s.partner_name, s.country_code,
      to_char(s.activity_date, 'YYYY-MM'),
      'settlement:' || s.status,
      'Settlement: ' || initcap(replace(s.status, '_', ' ')),
      0, 0, 0, 0, 0, 0, 0,
      (case when s.status in ('approved', 'closed') then 1 else 0 end)::bigint,
      0, 0::numeric
    from settlement_scope s
  ),
  country_grouped as (
    select country_code as key, country_code as label,
      sum(quote_inquiries) as quote_inquiries, sum(confirmed) as confirmed,
      sum(cancelled) as cancelled, sum(inquiries) as inquiries,
      sum(quote_cases) as quote_cases, sum(pax) as pax,
      sum(settlement_done) as settlement_done,
      sum(receivable_count) as receivable_count,
      sum(receivable_amount) as receivable_amount
    from facts group by country_code
  ),
  partner_grouped as (
    select agency_account_id::text as key, partner_name as label,
      sum(quote_inquiries) as quote_inquiries, sum(confirmed) as confirmed,
      sum(cancelled) as cancelled, sum(inquiries) as inquiries,
      sum(quote_cases) as quote_cases, sum(pax) as pax,
      sum(settlement_done) as settlement_done,
      sum(receivable_count) as receivable_count,
      sum(receivable_amount) as receivable_amount
    from facts group by agency_account_id, partner_name
  ),
  period_grouped as (
    select period_key as key, period_key as label,
      sum(quote_inquiries) as quote_inquiries, sum(confirmed) as confirmed,
      sum(cancelled) as cancelled, sum(inquiries) as inquiries,
      sum(quote_cases) as quote_cases, sum(pax) as pax,
      sum(settlement_done) as settlement_done,
      sum(receivable_count) as receivable_count,
      sum(receivable_amount) as receivable_amount
    from facts group by period_key
  ),
  status_grouped as (
    select status_key as key, status_label as label,
      sum(quote_inquiries) as quote_inquiries, sum(confirmed) as confirmed,
      sum(cancelled) as cancelled, sum(inquiries) as inquiries,
      sum(quote_cases) as quote_cases, sum(pax) as pax,
      sum(settlement_done) as settlement_done,
      sum(receivable_count) as receivable_count,
      sum(receivable_amount) as receivable_amount
    from facts group by status_key, status_label
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'quoteInquiryCount', coalesce(sum(quote_inquiries), 0),
      'confirmedCount', coalesce(sum(confirmed), 0),
      'cancelledCount', coalesce(sum(cancelled), 0),
      'totalInquiryCount', coalesce(sum(inquiries), 0),
      'quoteCaseCount', coalesce(sum(quote_cases), 0),
      'activeReservationCount', coalesce(sum(active_reservations), 0),
      'paxCount', coalesce(sum(pax), 0),
      'settlementDoneCount', coalesce(sum(settlement_done), 0),
      'receivableCount', coalesce(sum(receivable_count), 0),
      'receivableAmount', coalesce(sum(receivable_amount), 0)
    ),
    'countryRows', (
      select coalesce(jsonb_agg(to_jsonb(c) order by
        (c.quote_inquiries + c.confirmed + c.cancelled + c.inquiries + c.settlement_done + c.receivable_count) desc,
        c.label
      ), '[]'::jsonb) from country_grouped c
    ),
    'partnerRows', (
      select coalesce(jsonb_agg(to_jsonb(p) order by
        (p.quote_inquiries + p.confirmed + p.cancelled + p.inquiries + p.settlement_done + p.receivable_count) desc,
        p.label
      ), '[]'::jsonb) from partner_grouped p
    ),
    'periodRows', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.key desc), '[]'::jsonb)
      from period_grouped p
    ),
    'statusRows', (
      select coalesce(jsonb_agg(to_jsonb(s) order by
        (s.quote_inquiries + s.confirmed + s.cancelled + s.inquiries + s.settlement_done + s.receivable_count) desc,
        s.label
      ), '[]'::jsonb) from status_grouped s
    ),
    'agencyOptions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ao.id, 'name', ao.name, 'countryCode', ao.country_code
      ) order by ao.name), '[]'::jsonb)
      from agency_options ao
    )
  ) into result
  from facts;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_admin_dashboard_analytics(text, uuid, date, date) from public, anon;
grant execute on function public.get_admin_dashboard_analytics(text, uuid, date, date) to authenticated, service_role;

-- @file 한글 책임: Supabase 마이그레이션 `admin finance kpis`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

-- 관리자 대시보드 재무 KPI는 페이지네이션된 목록이 아니라 전체 대상 행을 DB에서 집계합니다.
create or replace function get_admin_finance_kpis(
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

  with reservation_scope as materialized (
    select
      r.id,
      r.agency_account_id,
      coalesce(r.tour_start_date, r.tour_end_date, r.created_at::date) as activity_date
    from reservations r
    join agency_accounts aa on aa.id = r.agency_account_id
    where (p_country is null or p_country = '' or upper(aa.country_code) = upper(p_country))
      and (p_agency_account_id is null or r.agency_account_id = p_agency_account_id)
      and (p_from is null or coalesce(r.tour_start_date, r.tour_end_date, r.created_at::date) >= p_from)
      and (p_to is null or coalesce(r.tour_start_date, r.tour_end_date, r.created_at::date) <= p_to)
  ),
  latest_invoices as materialized (
    select distinct on (i.reservation_id)
      i.id,
      i.reservation_id,
      i.status,
      i.total_amount
    from invoices i
    join reservation_scope rs on rs.id = i.reservation_id
    order by i.reservation_id, i.version_no desc, i.created_at desc
  ),
  confirmed_payments as (
    select p.invoice_id, coalesce(sum(p.amount), 0) as paid_amount
    from payments p
    join latest_invoices li on li.id = p.invoice_id
    where p.status = 'confirmed'
    group by p.invoice_id
  ),
  receivables as (
    select
      li.id,
      greatest(li.total_amount - coalesce(cp.paid_amount, 0), 0) as balance
    from latest_invoices li
    left join confirmed_payments cp on cp.invoice_id = li.id
    where li.status <> 'void'
  ),
  settlement_metrics as (
    select count(*) filter (where s.status in ('approved', 'closed'))::integer as done_count
    from settlements s
    join reservation_scope rs on rs.id = s.reservation_id
  )
  select jsonb_build_object(
    'settlementDoneCount', coalesce((select done_count from settlement_metrics), 0),
    'receivableCount', count(*) filter (where balance > 0),
    'receivableAmount', coalesce(sum(balance) filter (where balance > 0), 0)
  )
  into result
  from receivables;

  return coalesce(result, jsonb_build_object(
    'settlementDoneCount', 0,
    'receivableCount', 0,
    'receivableAmount', 0
  ));
end;
$$;

revoke all on function get_admin_finance_kpis(text, uuid, date, date) from public, anon;
grant execute on function get_admin_finance_kpis(text, uuid, date, date) to authenticated, service_role;

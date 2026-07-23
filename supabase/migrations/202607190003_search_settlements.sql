-- 정산 목록 검색이 최신 150건 안에서만 JS로 필터링돼, 그 뒤 정산은 검색되지 않던 문제(2026-07 P-1 잔여)를 해결합니다.
-- 검색 대상(reservation_code, tour_name, agency name)이 2단계 중첩 관계라 PostgREST 단일 쿼리로는
-- 여러 중첩 경로를 OR 검색할 수 없으므로, DB 함수에서 조인+검색+페이지네이션을 전체 대상에 적용합니다.
create or replace function public.search_settlements(
  p_status text default null,
  p_q text default null,
  p_limit integer default 150,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result jsonb;
  safe_limit integer := least(greatest(coalesce(p_limit, 150), 1), 500);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  -- 정산은 finance/admin 전용입니다(settlements RLS와 동일 경계).
  if not has_finance_role() then
    raise exception 'Finance role required' using errcode = '42501';
  end if;

  with scoped as (
    select
      s.id, s.reservation_id, s.status,
      s.total_invoice_amount, s.total_payment_amount, s.total_expense_amount,
      s.total_extra_revenue_amount, s.total_shopping_commission_amount,
      s.final_profit_amount, s.approved_at, s.created_at,
      r.reservation_code, qc.tour_name, aa.name as agency_name
    from settlements s
    join reservations r on r.id = s.reservation_id
    left join quote_cases qc on qc.id = r.quote_case_id
    left join agency_accounts aa on aa.id = r.agency_account_id
    where (p_status is null or p_status = '' or s.status::text = p_status)
      and (
        p_q is null or btrim(p_q) = ''
        or r.reservation_code ilike '%' || p_q || '%'
        or qc.tour_name ilike '%' || p_q || '%'
        or aa.name ilike '%' || p_q || '%'
      )
    order by s.created_at desc
    limit safe_limit offset safe_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'reservation_id', reservation_id,
        'status', status,
        'total_invoice_amount', total_invoice_amount,
        'total_payment_amount', total_payment_amount,
        'total_expense_amount', total_expense_amount,
        'total_extra_revenue_amount', total_extra_revenue_amount,
        'total_shopping_commission_amount', total_shopping_commission_amount,
        'final_profit_amount', final_profit_amount,
        'approved_at', approved_at,
        'created_at', created_at,
        'reservations', jsonb_build_object(
          'reservation_code', reservation_code,
          'quote_cases', case when tour_name is not null then jsonb_build_object('tour_name', tour_name) end,
          'agency_accounts', case when agency_name is not null then jsonb_build_object('name', agency_name) end
        )
      )
      order by created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from scoped;

  return result;
end;
$$;

revoke all on function public.search_settlements(text, text, integer, integer) from public, anon;
grant execute on function public.search_settlements(text, text, integer, integer) to authenticated, service_role;

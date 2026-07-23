-- 정산 검색도 나머지 목록 검색과 동일하게 다중 키워드(토큰-AND, 필드-OR)와 LIKE 이스케이프를 지원하게 합니다.
-- 예: "Seoul Busan"이 tour_name "Seoul and Busan Incentive"를 어순·인접 무관하게 매칭합니다.
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
  if not has_finance_role() then
    raise exception 'Finance role required' using errcode = '42501';
  end if;

  with tokens as (
    select tok
    from unnest(
      case
        when p_q is null or btrim(p_q) = '' then array[]::text[]
        else regexp_split_to_array(btrim(p_q), '\s+')
      end
    ) as t(tok)
    where btrim(tok) <> ''
  ),
  scoped as (
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
      -- 모든 토큰이 (예약코드/투어명/파트너명) 중 어딘가에는 리터럴로 포함되어야 합니다.
      and not exists (
        select 1
        from tokens
        where coalesce(r.reservation_code, '') not ilike '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
          and coalesce(qc.tour_name, '') not ilike '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
          and coalesce(aa.name, '') not ilike '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
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

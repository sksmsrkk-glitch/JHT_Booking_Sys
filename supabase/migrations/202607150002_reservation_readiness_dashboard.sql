-- 예약 운영 준비 상태를 작업 변경 시점에 계산해 대시보드의 반복 스캔을 제거합니다.
alter table reservations
  add column if not exists operation_ready boolean not null default false,
  add column if not exists operation_missing text[] not null default array[
    'Hotel block',
    'Hotel reconfirm / final confirmation',
    'Vehicle booking',
    'Guide assignment',
    'Driver information'
  ]::text[];

create index if not exists reservations_operation_ready_created_idx
  on reservations(operation_ready, created_at desc);

create or replace function refresh_reservation_operation_readiness(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hotel_block_done boolean;
  hotel_reconfirm_done boolean;
  vehicle_booking_done boolean;
  guide_assignment_done boolean;
  driver_info_done boolean;
  missing_items text[] := '{}'::text[];
begin
  if target_reservation_id is null then
    return;
  end if;

  select
    coalesce(bool_or(status::text in ('done', 'completed') and team::text = 'hotel_booking'
      and task_type ~* 'hotel[_-]?block|hotel[_-]?booking|room[_-]?block'), false),
    coalesce(bool_or(status::text in ('done', 'completed') and team::text = 'hotel_booking'
      and task_type ~* 'reconfirm|final|confirm'), false),
    coalesce(bool_or(status::text in ('done', 'completed') and team::text = 'vehicle_booking'
      and task_type ~* 'vehicle|coach|bus|transport'), false),
    coalesce(bool_or(status::text in ('done', 'completed') and team::text = 'guide_assignment'
      and task_type ~* 'guide'), false),
    coalesce(bool_or(status::text in ('done', 'completed') and team::text = 'vehicle_booking'
      and task_type ~* 'driver'), false)
  into hotel_block_done, hotel_reconfirm_done, vehicle_booking_done, guide_assignment_done, driver_info_done
  from operation_tasks
  where reservation_id = target_reservation_id;

  if not hotel_block_done then missing_items := array_append(missing_items, 'Hotel block'); end if;
  if not hotel_reconfirm_done then missing_items := array_append(missing_items, 'Hotel reconfirm / final confirmation'); end if;
  if not vehicle_booking_done then missing_items := array_append(missing_items, 'Vehicle booking'); end if;
  if not guide_assignment_done then missing_items := array_append(missing_items, 'Guide assignment'); end if;
  if not driver_info_done then missing_items := array_append(missing_items, 'Driver information'); end if;

  update reservations
  set operation_ready = cardinality(missing_items) = 0,
      operation_missing = missing_items
  where id = target_reservation_id;
end;
$$;

create or replace function sync_reservation_operation_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform refresh_reservation_operation_readiness(old.reservation_id);
    return old;
  end if;

  perform refresh_reservation_operation_readiness(new.reservation_id);
  if tg_op = 'UPDATE' and old.reservation_id is distinct from new.reservation_id then
    perform refresh_reservation_operation_readiness(old.reservation_id);
  end if;
  return new;
end;
$$;

drop trigger if exists operation_tasks_sync_reservation_readiness on operation_tasks;
create trigger operation_tasks_sync_reservation_readiness
  after insert or update of reservation_id, team, task_type, status or delete on operation_tasks
  for each row execute function sync_reservation_operation_readiness();

do $$
declare
  reservation_row record;
begin
  for reservation_row in select id from reservations loop
    perform refresh_reservation_operation_readiness(reservation_row.id);
  end loop;
end;
$$;

-- 전체 행을 애플리케이션으로 전송하지 않고 관리자 대시보드 집계를 DB에서 완료합니다.
create or replace function get_reservation_dashboard(
  p_q text default null,
  p_status text default null,
  p_month_start date default date_trunc('month', current_date)::date
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

  with filtered as materialized (
    select
      r.id,
      r.status::text as status,
      r.tour_start_date,
      r.tour_end_date,
      r.operation_ready,
      coalesce(qc.estimated_pax, 0) as pax,
      coalesce(aa.name, 'Unknown partner') as partner,
      coalesce(cr.country_name, nullif(aa.country_code, ''), 'Unspecified') as country
    from reservations r
    join quote_cases qc on qc.id = r.quote_case_id
    join agency_accounts aa on aa.id = r.agency_account_id
    left join country_references cr on cr.country_code = upper(aa.country_code) and cr.status = 'active'
    where (p_status is null or p_status = '' or r.status::text = p_status)
      and (
        p_q is null or btrim(p_q) = ''
        or r.reservation_code ilike '%' || btrim(p_q) || '%'
        or qc.case_code ilike '%' || btrim(p_q) || '%'
        or qc.tour_name ilike '%' || btrim(p_q) || '%'
        or aa.name ilike '%' || btrim(p_q) || '%'
      )
  ),
  monthly as (
    select coalesce(to_char(coalesce(tour_start_date, tour_end_date), 'YYYY-MM'), 'Unscheduled') as label,
           count(*)::integer as groups,
           coalesce(sum(pax), 0)::integer as pax
    from filtered
    group by 1
    order by 1 desc
    limit 24
  ),
  yearly as (
    select coalesce(to_char(coalesce(tour_start_date, tour_end_date), 'YYYY'), 'Unscheduled') as label,
           count(*)::integer as groups,
           coalesce(sum(pax), 0)::integer as pax
    from filtered
    group by 1
    order by 1 desc
    limit 10
  ),
  partner as (
    select partner as label, count(*)::integer as groups, coalesce(sum(pax), 0)::integer as pax
    from filtered group by partner order by groups desc, pax desc limit 20
  ),
  country as (
    select country as label, count(*)::integer as groups, coalesce(sum(pax), 0)::integer as pax
    from filtered group by country order by groups desc, pax desc limit 20
  ),
  month_bounds as (
    select date_trunc('month', coalesce(p_month_start, current_date))::date as month_start,
           (date_trunc('month', coalesce(p_month_start, current_date)) + interval '1 month - 1 day')::date as month_end
  ),
  week_bounds as (
    select week_start::date,
           (week_start + interval '6 days')::date as week_end
    from month_bounds,
      lateral generate_series(
        month_start - extract(dow from month_start)::integer,
        month_end,
        interval '7 days'
      ) week_start
  ),
  weekly as (
    select to_char(w.week_start, 'MM-DD') || ' ~ ' || to_char(w.week_end, 'MM-DD') as label,
           count(f.id)::integer as groups,
           coalesce(sum(f.pax), 0)::integer as pax,
           w.week_start
    from week_bounds w
    left join filtered f
      on coalesce(f.tour_start_date, f.tour_end_date) <= w.week_end
      and coalesce(f.tour_end_date, f.tour_start_date) >= w.week_start
    group by w.week_start, w.week_end
    order by w.week_start
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalGroups', count(*),
      'activeGroups', count(*) filter (where status not in ('completed', 'cancelled')),
      'totalPax', coalesce(sum(pax), 0),
      'incompleteGroups', count(*) filter (where not operation_ready),
      'unscheduledGroups', count(*) filter (where tour_start_date is null and tour_end_date is null)
    ),
    'summaries', jsonb_build_object(
      'monthly', coalesce((select jsonb_agg(to_jsonb(monthly)) from monthly), '[]'::jsonb),
      'weekly', coalesce((select jsonb_agg(to_jsonb(weekly) - 'week_start') from weekly), '[]'::jsonb),
      'yearly', coalesce((select jsonb_agg(to_jsonb(yearly)) from yearly), '[]'::jsonb),
      'partner', coalesce((select jsonb_agg(to_jsonb(partner_row)) from partner partner_row), '[]'::jsonb),
      'country', coalesce((select jsonb_agg(to_jsonb(country_row)) from country country_row), '[]'::jsonb)
    )
  ) into result
  from filtered;

  return coalesce(result, jsonb_build_object('metrics', '{}'::jsonb, 'summaries', '{}'::jsonb));
end;
$$;

revoke all on function get_reservation_dashboard(text, text, date) from public, anon;
grant execute on function get_reservation_dashboard(text, text, date) to authenticated, service_role;

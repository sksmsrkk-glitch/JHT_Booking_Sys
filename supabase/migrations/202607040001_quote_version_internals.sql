-- 2026-07-03 코드 리뷰 Phase 4 (결정 2): 내부 원가/마진 컬럼을 quote_versions에서
-- 분리해, agency JWT + anon key로 PostgREST를 직접 호출해도 마진이 노출되지 않게 합니다.
-- quote_versions 행은 agency가 select할 수 있으므로 컬럼 단위 보호만으로는 부족하고,
-- 민감 컬럼을 internal-only 테이블로 옮기는 것이 근본 대책입니다.

create table if not exists quote_version_internals (
  quote_version_id uuid primary key references quote_versions(id) on delete cascade,
  internal_total_cost_krw numeric(14,2) not null default 0,
  internal_total_margin_krw numeric(14,2) not null default 0,
  default_margin_rate numeric(8,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quote_version_internals enable row level security;

drop policy if exists "quote version internals internal only" on quote_version_internals;
create policy "quote version internals internal only"
  on quote_version_internals
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop trigger if exists quote_version_internals_updated_at on quote_version_internals;
create trigger quote_version_internals_updated_at
  before update on quote_version_internals
  for each row execute function set_updated_at();

-- 기존 데이터 백필: 모든 quote_versions의 내부 값을 새 테이블로 복사합니다.
insert into quote_version_internals (quote_version_id, internal_total_cost_krw, internal_total_margin_krw, default_margin_rate)
select id, internal_total_cost_krw, internal_total_margin_krw, default_margin_rate
from quote_versions
on conflict (quote_version_id) do nothing;

-- 내부 값도 sent 이후에는 불변이어야 하므로, 부모 버전이 draft/review일 때만 쓰기를 허용합니다.
create or replace function guard_quote_version_internals_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status quote_version_status;
begin
  if jht_is_privileged_session() then
    return coalesce(new, old);
  end if;
  select status into v_status
  from quote_versions
  where id = coalesce(new.quote_version_id, old.quote_version_id);
  if v_status is null or v_status not in ('draft', 'review') then
    raise exception 'quote version internals are immutable after the version leaves draft or review';
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function guard_quote_version_internals_mutation() from public;

drop trigger if exists quote_version_internals_immutable on quote_version_internals;
create trigger quote_version_internals_immutable
  before insert or update or delete on quote_version_internals
  for each row execute function guard_quote_version_internals_mutation();

-- Phase 1의 guard_quote_version_amounts 트리거는 곧 삭제될 컬럼을 참조하므로,
-- 이동한 3개 컬럼(internal_total_cost_krw, internal_total_margin_krw, default_margin_rate)을
-- 빼고 재정의합니다. public_total_amount/currency/exchange_rate_to_krw/margin_mode 불변은 유지합니다.
create or replace function guard_quote_version_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jht_is_privileged_session() then
    return new;
  end if;
  if old.status in ('sent', 'accepted', 'superseded', 'cancelled')
     and (
       new.public_total_amount is distinct from old.public_total_amount
       or new.currency is distinct from old.currency
       or new.exchange_rate_to_krw is distinct from old.exchange_rate_to_krw
       or new.margin_mode is distinct from old.margin_mode
     ) then
    raise exception 'quote version amounts are immutable after the version is sent';
  end if;
  return new;
end;
$$;

-- 이제 quote_versions에서 민감 컬럼을 제거합니다(백필 완료 후).
alter table quote_versions drop column if exists internal_total_cost_krw;
alter table quote_versions drop column if exists internal_total_margin_krw;
alter table quote_versions drop column if exists default_margin_rate;

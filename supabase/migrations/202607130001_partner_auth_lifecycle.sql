-- 파트너 계정 동결과 개별 사용자 강제 탈퇴를 구분합니다.
-- 계정 재활성화 시에는 계정 동결 때문에 중지된 사용자만 복구하며,
-- 관리자가 개별 탈퇴시킨 사용자는 자동으로 되살리지 않습니다.
alter table agency_users
  add column if not exists suspended_by_account_at timestamptz;

alter table agency_signup_applications
  add column if not exists request_fingerprint text;

create index if not exists agency_signup_applications_rate_limit_idx
  on agency_signup_applications(request_fingerprint, created_at desc)
  where request_fingerprint is not null;

create index if not exists agency_users_account_suspension_idx
  on agency_users(agency_account_id, suspended_by_account_at)
  where suspended_by_account_at is not null;

-- 이전 코드가 frozen 계정에도 forced_withdrawn_at을 기록했으므로 의미를 분리해 백필합니다.
update agency_users au
set suspended_by_account_at = coalesce(au.forced_withdrawn_at, now()),
    forced_withdrawn_at = null
from agency_accounts aa
where aa.id = au.agency_account_id
  and aa.lifecycle_status = 'frozen'
  and au.status = 'inactive'
  and au.suspended_by_account_at is null;

create or replace function guard_agency_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jht_is_privileged_session() or has_internal_role() then
    return new;
  end if;
  if new.agency_account_id is distinct from old.agency_account_id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.email is distinct from old.email
     or new.is_account_admin is distinct from old.is_account_admin
     or new.status is distinct from old.status
     or new.account_role is distinct from old.account_role
     or new.parent_agency_user_id is distinct from old.parent_agency_user_id
     or new.forced_withdrawn_at is distinct from old.forced_withdrawn_at
     or new.suspended_by_account_at is distinct from old.suspended_by_account_at then
    raise exception 'agency users cannot change protected account fields';
  end if;
  return new;
end;
$$;

-- @file 한글 책임: Supabase 마이그레이션 `account recovery`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

-- 로그인 화면에서 발생한 이메일 찾기와 비밀번호 재설정 요청을 운영자가 추적할 수 있는 원장입니다.
-- 공개 화면은 service role을 사용하는 서버 API로만 기록하며, 조회와 처리는 내부 사용자에게만 허용합니다.
create table if not exists account_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  recovery_type text not null check (recovery_type in ('email_lookup', 'password_reset')),
  account_type text not null check (account_type in ('internal', 'agency')),
  submitted_email citext,
  company_name text,
  contact_name text,
  phone_last_four text,
  matched_agency_user_id uuid references agency_users(id) on delete set null,
  result text not null default 'pending' check (result in ('pending', 'masked_email_shown', 'reset_email_requested')),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  request_fingerprint text not null,
  resolution_note text,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_recovery_requests_status_idx
  on account_recovery_requests(status, created_at desc);

create index if not exists account_recovery_requests_fingerprint_idx
  on account_recovery_requests(request_fingerprint, created_at desc);

alter table account_recovery_requests enable row level security;

drop policy if exists "account recovery internal all" on account_recovery_requests;
create policy "account recovery internal all"
  on account_recovery_requests
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop trigger if exists account_recovery_requests_updated_at on account_recovery_requests;
create trigger account_recovery_requests_updated_at
  before update on account_recovery_requests
  for each row execute function set_updated_at();

-- Security hardening 마이그레이션은 anon 기본 권한을 제거하므로 공개 클라이언트가 이 표에 직접 접근할 수 없습니다.
revoke all privileges on table account_recovery_requests from anon;
grant select, insert, update, delete on table account_recovery_requests to authenticated;
grant all privileges on table account_recovery_requests to service_role;

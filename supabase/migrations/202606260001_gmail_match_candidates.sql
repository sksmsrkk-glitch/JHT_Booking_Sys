-- @file 한글 책임: Supabase 마이그레이션 `gmail match candidates`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

create table if not exists gmail_match_candidates (
  id uuid primary key default gen_random_uuid(),
  email_thread_id uuid not null references email_threads(id) on delete cascade,
  quote_case_id uuid not null references quote_cases(id) on delete cascade,
  agency_account_id uuid references agency_accounts(id),
  score numeric(4,2) not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  requires_manual_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_thread_id, quote_case_id)
);

create trigger gmail_match_candidates_updated_at
before update on gmail_match_candidates
for each row execute function set_updated_at();

alter table gmail_match_candidates enable row level security;

create policy "gmail match candidates internal all"
on gmail_match_candidates
for all
using (has_internal_role())
with check (has_internal_role());

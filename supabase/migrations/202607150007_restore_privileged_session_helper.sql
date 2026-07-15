-- SQL Editor로 수동 구축된 초기 환경에서 누락될 수 있는 보안 헬퍼를 복원합니다.
-- 신규 RPC와 보호 트리거가 공통으로 사용하므로 모든 환경에서 정의를 보장해야 합니다.

create or replace function jht_is_privileged_session()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), 'postgres') in ('postgres', 'supabase_admin', 'service_role');
$$;

revoke execute on function jht_is_privileged_session() from public;
grant execute on function jht_is_privileged_session() to anon, authenticated, service_role;

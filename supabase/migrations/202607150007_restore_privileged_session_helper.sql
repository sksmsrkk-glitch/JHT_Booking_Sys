-- @file 한글 책임: Supabase 마이그레이션 `restore privileged session helper`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

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

-- Supabase Data API 역할 권한을 명시적으로 관리합니다.
-- 신규 프로젝트에서 "Automatically expose new tables"를 끄면 테이블/RLS는 생성되어도
-- anon/authenticated/service_role 역할에 기본 접근 권한이 없어 REST API가 403을 반환할 수 있습니다.
-- RLS 정책이 실제 행 접근을 계속 제한하므로, 여기서는 API 역할이 정책 평가 지점까지 도달하도록 권한만 엽니다.

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all privileges on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant all privileges on sequences to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

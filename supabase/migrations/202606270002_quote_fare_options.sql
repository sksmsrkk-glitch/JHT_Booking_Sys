-- @file 한글 책임: Supabase 마이그레이션 `quote fare options`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

alter table quote_versions
  add column if not exists public_fare_options jsonb not null default '[]'::jsonb,
  add column if not exists excel_source_summary jsonb not null default '{}'::jsonb;

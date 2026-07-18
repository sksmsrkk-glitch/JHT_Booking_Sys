-- @file 한글 책임: Supabase 마이그레이션 `quote excel model`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

alter table quote_items
  add column if not exists service_section text not null default 'land',
  add column if not exists calculation_mode text not null default 'auto_formula',
  add column if not exists excel_cell_ref text,
  add column if not exists excel_formula text,
  add column if not exists manual_override boolean not null default false,
  add column if not exists supplier_cost_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists public_breakdown jsonb not null default '{}'::jsonb;

create index if not exists quote_items_version_section_idx
  on quote_items(quote_version_id, service_section, item_category);

create index if not exists agency_inquiries_related_quote_case_created_idx
  on agency_inquiries(related_quote_case_id, created_at);

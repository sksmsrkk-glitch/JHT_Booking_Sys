-- @file 한글 책임: Supabase 마이그레이션 `quote presentation blocks`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

create table if not exists quote_presentation_blocks (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id) on delete cascade,
  quote_itinerary_day_id uuid references quote_itinerary_days(id) on delete cascade,
  source_supplier_media_id uuid references supplier_media(id),
  block_type text not null default 'image',
  display_context text not null default 'itinerary',
  title text,
  description text,
  image_storage_path text,
  image_url text,
  alt_text text,
  sort_order integer not null default 1 check (sort_order > 0),
  is_public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quote_presentation_blocks_version_idx
  on quote_presentation_blocks(quote_version_id, display_context, sort_order);

create index if not exists quote_presentation_blocks_day_idx
  on quote_presentation_blocks(quote_itinerary_day_id, sort_order);

alter table quote_presentation_blocks enable row level security;

create policy "quote presentation blocks internal all" on quote_presentation_blocks
  for all using (has_internal_role()) with check (has_internal_role());

create policy "quote presentation blocks agency select" on quote_presentation_blocks
  for select using (
    is_public = true and exists (
      select 1
      from quote_versions qv
      join quote_cases qc on qc.id = qv.quote_case_id
      where qv.id = quote_presentation_blocks.quote_version_id
        and qv.status in ('sent', 'accepted', 'superseded')
        and is_agency_member(qc.agency_account_id)
    )
  );

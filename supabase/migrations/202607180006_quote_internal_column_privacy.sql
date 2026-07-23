-- 파트너(agency)는 quote_versions / quote_itinerary_days 행을 select할 수 있으므로,
-- 내부 전용 컬럼이 그 행에 남아 있으면 anon key + agency JWT로 PostgREST를 직접 호출해
-- 컬럼 단위로 유출됩니다(2026-07 실사용 감사에서 라이브 확인). 202607040001이 마진/원가에
-- 적용한 "internal-only 테이블 분리" 원칙을 남은 두 컬럼에도 동일하게 적용합니다.

-- 1) quote_versions.excel_source_summary → quote_version_internals 로 이전
--    (내부 엑셀 원가모델 요약. 원본 워크북 파일명/수식/추출 메모 등이 담길 수 있음)
alter table quote_version_internals
  add column if not exists excel_source_summary jsonb not null default '{}'::jsonb;

update quote_version_internals qvi
set excel_source_summary = coalesce(qv.excel_source_summary, '{}'::jsonb)
from quote_versions qv
where qv.id = qvi.quote_version_id;

alter table quote_versions drop column if exists excel_source_summary;

-- 2) quote_itinerary_days.internal_notes → quote_itinerary_day_internals 로 이전
--    (내부 운영 메모. 공급자/원가/현장 지시 등이 담길 수 있음)
create table if not exists quote_itinerary_day_internals (
  quote_itinerary_day_id uuid primary key references quote_itinerary_days(id) on delete cascade,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quote_itinerary_day_internals enable row level security;

drop policy if exists "quote itinerary day internals internal only" on quote_itinerary_day_internals;
create policy "quote itinerary day internals internal only"
  on quote_itinerary_day_internals
  for all
  using (has_internal_role())
  with check (has_internal_role());

drop trigger if exists quote_itinerary_day_internals_updated_at on quote_itinerary_day_internals;
create trigger quote_itinerary_day_internals_updated_at
  before update on quote_itinerary_day_internals
  for each row execute function set_updated_at();

insert into quote_itinerary_day_internals (quote_itinerary_day_id, internal_notes)
select id, internal_notes
from quote_itinerary_days
where internal_notes is not null and btrim(internal_notes) <> ''
on conflict (quote_itinerary_day_id) do nothing;

alter table quote_itinerary_days drop column if exists internal_notes;

-- FK 조회 인덱스(내부 화면에서 일자별 내부 메모 조인 시 사용)
create index if not exists quote_itinerary_day_internals_day_idx
  on quote_itinerary_day_internals(quote_itinerary_day_id);

-- @file 한글 책임: Supabase 마이그레이션 `agency inquiry tour workflow`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

alter table agency_inquiries
  add column if not exists tour_code text,
  add column if not exists arrival_date date,
  add column if not exists departure_date date,
  add column if not exists period_text text,
  add column if not exists nights_count integer check (nights_count is null or nights_count > 0),
  add column if not exists flight_details jsonb not null default '[]'::jsonb;

create index if not exists agency_inquiries_tour_code_idx
  on agency_inquiries(tour_code);

create index if not exists agency_inquiries_arrival_departure_idx
  on agency_inquiries(arrival_date, departure_date);

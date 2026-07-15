-- 대량 목록의 부분 검색과 최신순 조회를 지원하는 운영 인덱스입니다.
-- 인덱스는 실제 API의 WHERE/ORDER BY 조합에만 추가해 쓰기 증폭을 제한합니다.

create extension if not exists pg_trgm;

-- 견적 및 문의: 파트너 범위, 상태, 최신순과 사용자가 입력하는 코드/제목 검색을 지원합니다.
create index if not exists quote_cases_status_created_idx
  on quote_cases(status, created_at desc);
create index if not exists quote_cases_agency_created_idx
  on quote_cases(agency_account_id, created_at desc);
create index if not exists quote_cases_case_code_trgm_idx
  on quote_cases using gin (case_code gin_trgm_ops);
create index if not exists quote_cases_tour_name_trgm_idx
  on quote_cases using gin (tour_name gin_trgm_ops);

create index if not exists agency_inquiries_agency_created_idx
  on agency_inquiries(agency_account_id, created_at desc);
create index if not exists agency_inquiries_tour_code_trgm_idx
  on agency_inquiries using gin (tour_code gin_trgm_ops);
create index if not exists agency_inquiries_title_trgm_idx
  on agency_inquiries using gin (title gin_trgm_ops);

-- 예약: 월간 달력의 날짜 겹침 조건과 운영 목록의 상태/최신순 조건을 지원합니다.
create index if not exists reservations_status_created_idx
  on reservations(status, created_at desc);
create index if not exists reservations_agency_created_idx
  on reservations(agency_account_id, created_at desc);
create index if not exists reservations_tour_dates_idx
  on reservations(tour_start_date, tour_end_date)
  where tour_start_date is not null or tour_end_date is not null;
create index if not exists reservations_code_trgm_idx
  on reservations using gin (reservation_code gin_trgm_ops);

-- 국내 원가 마스터: 카테고리/상태 필터 후 이름과 키워드로 검색하는 경로를 지원합니다.
create index if not exists domestic_suppliers_category_status_name_idx
  on domestic_suppliers(category, status, name_ko);
create index if not exists domestic_suppliers_name_ko_trgm_idx
  on domestic_suppliers using gin (name_ko gin_trgm_ops);
create index if not exists domestic_suppliers_name_en_trgm_idx
  on domestic_suppliers using gin (name_en gin_trgm_ops);
create index if not exists domestic_suppliers_search_keywords_trgm_idx
  on domestic_suppliers using gin (search_keywords gin_trgm_ops);

-- 파트너/워크플로우/인보이스: 관리자 검색과 최신 활동순 원장을 지원합니다.
create index if not exists agency_accounts_status_created_idx
  on agency_accounts(status, created_at desc);
create index if not exists agency_accounts_name_trgm_idx
  on agency_accounts using gin (name gin_trgm_ops);
create index if not exists agency_accounts_email_domain_trgm_idx
  on agency_accounts using gin (email_domain gin_trgm_ops);

create index if not exists workflow_threads_activity_idx
  on workflow_threads(last_message_at desc nulls last, created_at desc);
create index if not exists workflow_threads_code_trgm_idx
  on workflow_threads using gin (workflow_code gin_trgm_ops);
create index if not exists workflow_threads_title_trgm_idx
  on workflow_threads using gin (title gin_trgm_ops);

create index if not exists invoices_status_created_idx
  on invoices(status, created_at desc);
create index if not exists invoices_invoice_no_trgm_idx
  on invoices using gin (invoice_no gin_trgm_ops);
create index if not exists invoices_tour_code_trgm_idx
  on invoices using gin (tour_code gin_trgm_ops);

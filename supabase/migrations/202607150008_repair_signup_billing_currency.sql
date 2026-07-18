-- @file 한글 책임: Supabase 마이그레이션 `repair signup billing currency`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

-- 이미 적용된 과거 마이그레이션 파일과 원격 스키마가 달라진 환경을 복구합니다.
-- 파트너 가입 신청의 통화는 자유 문자열이 아니라 국가 공통 마스터의 기본 통화를 사용합니다.
alter table agency_signup_applications
  add column if not exists requested_billing_currency text;

update agency_signup_applications application
set requested_billing_currency = reference.default_currency
from country_references reference
where application.country_code = reference.country_code
  and application.requested_billing_currency is null
  and reference.default_currency is not null;


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


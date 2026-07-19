-- @file 한글 책임: 구형 관리자 재무 KPI RPC를 제거해 대시보드 집계 진입점을 하나로 통합합니다.
-- 전체 KPI와 분해 행은 get_admin_dashboard_analytics가 상위 호환하므로 중복 함수와 권한 표면을 남기지 않습니다.

drop function if exists public.get_admin_finance_kpis(text, uuid, date, date);

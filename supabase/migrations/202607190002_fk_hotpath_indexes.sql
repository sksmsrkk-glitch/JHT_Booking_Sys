-- FK 조인/필터/삭제 hot path 인덱스 보강 (2026-07 확장성 감사 P-1).
-- 96개 FK 컬럼 중 write-tracking(created_by/updated_by/approved_by 등)은 제외하고,
-- 실제 조회·집계·FK 삭제 성능에 영향을 주는 컬럼만 선별해 인덱스를 추가합니다.
-- 모두 create index if not exists라 재실행/드리프트 환경에서도 안전합니다.

-- 결제/인보이스: payments.invoice_id는 restrict FK인데 인덱스가 없어 인보이스 조회·삭제가 seq scan이었습니다.
create index if not exists payments_invoice_id_idx on payments(invoice_id);
create index if not exists guide_expense_reports_invoice_id_idx on guide_expense_reports(invoice_id);
create index if not exists workflow_messages_linked_invoice_id_idx on workflow_messages(linked_invoice_id);
create index if not exists workflow_threads_current_invoice_id_idx on workflow_threads(current_invoice_id);

-- 예약 범위 집계(정산/운영/공급자 커뮤니케이션)에서 매번 reservation_id로 조인합니다.
create index if not exists expenses_reservation_id_idx on expenses(reservation_id);
create index if not exists extra_revenues_reservation_id_idx on extra_revenues(reservation_id);
create index if not exists shopping_commissions_reservation_id_idx on shopping_commissions(reservation_id);
create index if not exists reservation_status_history_reservation_id_idx on reservation_status_history(reservation_id);
create index if not exists room_assignments_reservation_id_idx on room_assignments(reservation_id);
create index if not exists supplier_message_outbox_reservation_id_idx on supplier_message_outbox(reservation_id);
create index if not exists email_threads_reservation_id_idx on email_threads(reservation_id);

-- 운영 태스크/알림/리마인더: 새 알림 인박스와 리마인더 자동화가 이 컬럼들로 조회합니다.
create index if not exists notifications_operation_task_id_idx on notifications(operation_task_id);
create index if not exists notifications_recipient_profile_id_idx on notifications(recipient_profile_id);
create index if not exists operation_reminder_logs_operation_task_id_idx on operation_reminder_logs(operation_task_id);
create index if not exists operation_tasks_assigned_to_idx on operation_tasks(assigned_to);
create index if not exists operation_tasks_domestic_supplier_id_idx on operation_tasks(domestic_supplier_id);

-- 견적 상세/원가 계보: 견적 버전 상세 조회 시 item·export 조인.
create index if not exists quote_items_itinerary_day_id_idx on quote_items(itinerary_day_id);
create index if not exists quote_items_source_supplier_product_id_idx on quote_items(source_supplier_product_id);
create index if not exists quote_items_source_supplier_price_id_idx on quote_items(source_supplier_price_id);
create index if not exists quote_exports_quote_version_id_idx on quote_exports(quote_version_id);

-- 이메일/Gmail 매칭.
create index if not exists email_attachments_email_message_id_idx on email_attachments(email_message_id);
create index if not exists email_threads_quote_case_id_idx on email_threads(quote_case_id);
create index if not exists email_threads_agency_account_id_idx on email_threads(agency_account_id);
create index if not exists gmail_match_candidates_quote_case_id_idx on gmail_match_candidates(quote_case_id);
create index if not exists gmail_match_candidates_agency_account_id_idx on gmail_match_candidates(agency_account_id);

-- 공급자 마스터/비용 조회.
create index if not exists supplier_products_domestic_supplier_id_idx on supplier_products(domestic_supplier_id);
create index if not exists domestic_suppliers_company_id_idx on domestic_suppliers(company_id);
create index if not exists expenses_domestic_supplier_id_idx on expenses(domestic_supplier_id);
create index if not exists shopping_commissions_domestic_supplier_id_idx on shopping_commissions(domestic_supplier_id);
create index if not exists supplier_message_outbox_domestic_supplier_id_idx on supplier_message_outbox(domestic_supplier_id);

-- 루밍리스트/승객.
create index if not exists passengers_rooming_list_id_idx on passengers(rooming_list_id);
create index if not exists room_assignments_rooming_list_id_idx on room_assignments(rooming_list_id);

-- 워크플로우 연결.
create index if not exists workflow_threads_agency_inquiry_id_idx on workflow_threads(agency_inquiry_id);
create index if not exists workflow_messages_linked_quote_version_id_idx on workflow_messages(linked_quote_version_id);
create index if not exists workflow_action_items_source_message_id_idx on workflow_action_items(source_message_id);

-- 파트너 연락처, 감사 로그 조회.
create index if not exists agency_contacts_agency_account_id_idx on agency_contacts(agency_account_id);
create index if not exists audit_logs_actor_profile_id_idx on audit_logs(actor_profile_id);
create index if not exists audit_logs_entity_idx on audit_logs(entity_table, entity_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

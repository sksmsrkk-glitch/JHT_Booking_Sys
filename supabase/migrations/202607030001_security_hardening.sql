-- @file 한글 책임: Supabase 마이그레이션 `security hardening`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

-- 2026-07-03 코드 리뷰 P0 보안 강화 마이그레이션.
-- 기존 마이그레이션 파일은 수정하지 않고 추가(additive) 방식으로만 조정합니다.
-- 대상: Data API 권한 축소, agency 계정 보호, 예약 상태 이력 강제,
--       견적 스냅샷 불변성, 재무 정책 복원, 중복 방지 제약, 워크플로 경계 강화.

-- ---------------------------------------------------------------------------
-- 1) Data API 역할 권한 축소
--    202607020001이 anon/authenticated에 all privileges(truncate 포함)를 부여했던 것을
--    회수하고, RLS 정책 평가에 필요한 최소 권한만 남깁니다.
-- ---------------------------------------------------------------------------

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

revoke all privileges on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 공개 화면(국가 목록 조회, 에이전시 가입 신청)에 필요한 최소 권한만 anon에 남깁니다.
grant select on country_references to anon;
grant insert on agency_signup_applications to anon;

-- anon 요청에서도 RLS 정책 표현식이 호출하는 helper 함수는 실행 권한이 필요합니다.
grant execute on function has_internal_role() to anon;
grant execute on function has_finance_role() to anon;
grant execute on function is_agency_member(uuid) to anon;
grant execute on function can_access_quote_case(uuid) to anon;
grant execute on function can_access_reservation(uuid) to anon;

-- 향후 생성되는 객체가 anon에 자동으로 열리지 않게 default privileges를 정리합니다.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- 2) 세션 신뢰 판별 helper
--    service_role 또는 직접 DB 접속(postgres, 마이그레이션/시드)은 보호 트리거를 통과합니다.
-- ---------------------------------------------------------------------------

create or replace function jht_is_privileged_session()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), 'postgres') in ('postgres', 'supabase_admin', 'service_role');
$$;

revoke execute on function jht_is_privileged_session() from public;
grant execute on function jht_is_privileged_session() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) agency_users 보호: 자기 행 업데이트로 소속 이전/권한 상승을 막습니다.
--    RLS "agency users self update" 정책은 행만 제한하고 컬럼은 제한하지 못하므로
--    트리거로 보호 컬럼 변경을 차단합니다.
-- ---------------------------------------------------------------------------

create or replace function guard_agency_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jht_is_privileged_session() or has_internal_role() then
    return new;
  end if;
  if new.agency_account_id is distinct from old.agency_account_id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.email is distinct from old.email
     or new.is_account_admin is distinct from old.is_account_admin
     or new.status is distinct from old.status
     or new.account_role is distinct from old.account_role
     or new.parent_agency_user_id is distinct from old.parent_agency_user_id
     or new.forced_withdrawn_at is distinct from old.forced_withdrawn_at then
    raise exception 'agency users cannot change protected account fields';
  end if;
  return new;
end;
$$;

revoke execute on function guard_agency_user_update() from public;

drop trigger if exists agency_users_guard_update on agency_users;
create trigger agency_users_guard_update
  before update on agency_users
  for each row execute function guard_agency_user_update();

-- ---------------------------------------------------------------------------
-- 4) 에이전시 가입 신청: 익명 insert는 pending 상태의 순수 신청만 허용합니다.
--    (승인 상태/검토자/생성 계정 스푸핑 차단)
-- ---------------------------------------------------------------------------

drop policy if exists "agency signup applications public insert" on agency_signup_applications;
create policy "agency signup applications public insert"
  on agency_signup_applications
  for insert
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and created_agency_account_id is null
    and created_mother_agency_user_id is null
    and email_notification_status = 'not_sent'
  );

-- ---------------------------------------------------------------------------
-- 5) 예약 상태 이력 DB 강제: 상태가 바뀌면 항상 reservation_status_history를 남깁니다.
--    앱 라우트는 update_reservation_status RPC를 사용해 사유를 함께 기록합니다.
-- ---------------------------------------------------------------------------

create or replace function log_reservation_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into reservation_status_history (reservation_id, from_status, to_status, reason, changed_by)
    values (
      new.id,
      old.status,
      new.status,
      nullif(current_setting('jht.reservation_status_reason', true), ''),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

revoke execute on function log_reservation_status_change() from public;

drop trigger if exists reservations_log_status_change on reservations;
create trigger reservations_log_status_change
  after update on reservations
  for each row execute function log_reservation_status_change();

create or replace function update_reservation_status(
  p_reservation_id uuid,
  p_status reservation_status,
  p_reason text default null
)
returns reservations
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row reservations;
begin
  perform set_config('jht.reservation_status_reason', coalesce(p_reason, ''), true);
  update reservations
  set status = p_status,
      confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end,
      cancelled_at = case when p_status = 'cancelled' and cancelled_at is null then now() else cancelled_at end
  where id = p_reservation_id
  returning * into v_row;
  if not found then
    raise exception 'reservation not found or not updatable';
  end if;
  perform set_config('jht.reservation_status_reason', '', true);
  return v_row;
end;
$$;

revoke execute on function update_reservation_status(uuid, reservation_status, text) from public, anon;
grant execute on function update_reservation_status(uuid, reservation_status, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) 견적 스냅샷 불변성: sent 이후 버전의 quote_items와 금액 컬럼을 DB에서 잠급니다.
-- ---------------------------------------------------------------------------

create or replace function guard_quote_item_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status quote_version_status;
begin
  if jht_is_privileged_session() then
    return coalesce(new, old);
  end if;
  select status into v_status
  from quote_versions
  where id = coalesce(new.quote_version_id, old.quote_version_id);
  if v_status is null or v_status not in ('draft', 'review') then
    raise exception 'quote items are immutable after the quote version leaves draft or review';
  end if;
  if tg_op = 'UPDATE' and new.quote_version_id is distinct from old.quote_version_id then
    raise exception 'quote items cannot move between quote versions';
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function guard_quote_item_mutation() from public;

drop trigger if exists quote_items_immutable on quote_items;
create trigger quote_items_immutable
  before insert or update or delete on quote_items
  for each row execute function guard_quote_item_mutation();

create or replace function guard_quote_version_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jht_is_privileged_session() then
    return new;
  end if;
  if old.status in ('sent', 'accepted', 'superseded', 'cancelled')
     and (
       new.public_total_amount is distinct from old.public_total_amount
       or new.internal_total_cost_krw is distinct from old.internal_total_cost_krw
       or new.internal_total_margin_krw is distinct from old.internal_total_margin_krw
       or new.currency is distinct from old.currency
       or new.exchange_rate_to_krw is distinct from old.exchange_rate_to_krw
       or new.default_margin_rate is distinct from old.default_margin_rate
       or new.margin_mode is distinct from old.margin_mode
     ) then
    raise exception 'quote version amounts are immutable after the version is sent';
  end if;
  return new;
end;
$$;

revoke execute on function guard_quote_version_amounts() from public;

drop trigger if exists quote_versions_amounts_immutable on quote_versions;
create trigger quote_versions_amounts_immutable
  before update on quote_versions
  for each row execute function guard_quote_version_amounts();

-- ---------------------------------------------------------------------------
-- 7) 인보이스 쓰기 권한 복원: 발행은 finance 전용, 내부 롤은 draft 작성까지만.
--    agency에는 draft 인보이스를 숨깁니다.
-- ---------------------------------------------------------------------------

drop policy if exists "invoices internal all" on invoices;
create policy "invoices internal all"
  on invoices
  for all
  using (has_finance_role() or has_internal_role())
  with check (has_finance_role() or (has_internal_role() and status = 'draft'));

drop policy if exists "invoice line items internal all" on invoice_line_items;
create policy "invoice line items internal all"
  on invoice_line_items
  for all
  using (has_finance_role() or has_internal_role())
  with check (
    has_finance_role()
    or (
      has_internal_role()
      and exists (
        select 1 from invoices i
        where i.id = invoice_line_items.invoice_id
          and i.status = 'draft'
      )
    )
  );

drop policy if exists "invoices agency select" on invoices;
create policy "invoices agency select"
  on invoices
  for select
  using (status <> 'draft' and can_access_reservation(reservation_id));

drop policy if exists "invoice line items agency select" on invoice_line_items;
create policy "invoice line items agency select"
  on invoice_line_items
  for select
  using (
    exists (
      select 1 from invoices i
      where i.id = invoice_line_items.invoice_id
        and i.status <> 'draft'
        and can_access_reservation(i.reservation_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 8) 결제 멱등성: idempotency_key를 필수 + 전역 유니크로 강제합니다.
-- ---------------------------------------------------------------------------

update payments set idempotency_key = id::text where idempotency_key is null;
alter table payments alter column idempotency_key set not null;
drop index if exists payments_idempotency_key_uidx;
alter table payments drop constraint if exists payments_idempotency_key_uidx;
alter table payments add constraint payments_idempotency_key_uidx unique (idempotency_key);

-- ---------------------------------------------------------------------------
-- 9) 중복 방지 제약
-- ---------------------------------------------------------------------------

-- 같은 견적 케이스로 활성 예약이 두 번 생기지 않게 합니다.
create unique index if not exists reservations_active_quote_case_uidx
  on reservations(quote_case_id)
  where status <> 'cancelled';

-- 자동 생성 운영 태스크(공급자 미지정)의 동시 중복 생성을 막습니다.
-- 기존 unique(reservation_id, task_type, domestic_supplier_id)는 null 공급자에 적용되지 않습니다.
create unique index if not exists operation_tasks_generated_task_uidx
  on operation_tasks(reservation_id, task_type)
  where domestic_supplier_id is null;

-- 인보이스 라인 번호 중복을 막습니다.
alter table invoice_line_items drop constraint if exists invoice_line_items_invoice_line_no_key;
alter table invoice_line_items add constraint invoice_line_items_invoice_line_no_key unique (invoice_id, line_no);

-- 환율: null 컬럼 때문에 무력화되던 유니크를 coalesce 식으로 보강합니다.
create unique index if not exists exchange_rates_rate_key_uidx
  on exchange_rates (coalesce(country_code, ''), base_currency, quote_currency, effective_date, coalesce(source, ''));

-- ---------------------------------------------------------------------------
-- 10) 재무 이력 보호: 예약 삭제가 결제/정산 기록을 연쇄 삭제하지 않게 restrict로 전환합니다.
-- ---------------------------------------------------------------------------

alter table invoices drop constraint if exists invoices_reservation_id_fkey;
alter table invoices add constraint invoices_reservation_id_fkey
  foreign key (reservation_id) references reservations(id) on delete restrict;

alter table payments drop constraint if exists payments_invoice_id_fkey;
alter table payments add constraint payments_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete restrict;

alter table expenses drop constraint if exists expenses_reservation_id_fkey;
alter table expenses add constraint expenses_reservation_id_fkey
  foreign key (reservation_id) references reservations(id) on delete restrict;

alter table extra_revenues drop constraint if exists extra_revenues_reservation_id_fkey;
alter table extra_revenues add constraint extra_revenues_reservation_id_fkey
  foreign key (reservation_id) references reservations(id) on delete restrict;

alter table shopping_commissions drop constraint if exists shopping_commissions_reservation_id_fkey;
alter table shopping_commissions add constraint shopping_commissions_reservation_id_fkey
  foreign key (reservation_id) references reservations(id) on delete restrict;

alter table settlements drop constraint if exists settlements_reservation_id_fkey;
alter table settlements add constraint settlements_reservation_id_fkey
  foreign key (reservation_id) references reservations(id) on delete restrict;

alter table guide_expense_reports drop constraint if exists guide_expense_reports_reservation_id_fkey;
alter table guide_expense_reports add constraint guide_expense_reports_reservation_id_fkey
  foreign key (reservation_id) references reservations(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 11) 공급자 메시지 2차 승인: 1차 승인자와 동일인 승인 차단.
-- ---------------------------------------------------------------------------

alter table supplier_message_outbox drop constraint if exists supplier_message_outbox_distinct_second_approver;
alter table supplier_message_outbox add constraint supplier_message_outbox_distinct_second_approver
  check (second_approved_by is null or approved_by is null or second_approved_by <> approved_by);

-- ---------------------------------------------------------------------------
-- 12) 부트스트랩 1회성 플래그: admin 롤 카운트 대신 소진형 플래그로 재무장을 차단합니다.
--     쓰기 정책이 없으므로 service role만 기록할 수 있습니다.
-- ---------------------------------------------------------------------------

create table if not exists system_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table system_flags enable row level security;

drop policy if exists "system flags internal read" on system_flags;
create policy "system flags internal read"
  on system_flags
  for select
  using (has_internal_role());

-- ---------------------------------------------------------------------------
-- 13) 워크플로 경계 강화
--     - 스레드/메시지 insert 시 링크된 견적/예약/인보이스가 같은 에이전시 소속인지 검증
--     - 에이전시 사용자의 스레드 상태 갱신(메시지 작성 후 waiting_internal)을 허용하되
--       상태 필드 외 변경은 트리거로 차단
--     - 첨부 업로드 정책 추가(메시지는 쓸 수 있는데 첨부만 막혀 있던 공백 해소)
-- ---------------------------------------------------------------------------

drop policy if exists "workflow threads agency insert" on workflow_threads;
create policy "workflow threads agency insert"
  on workflow_threads
  for insert
  with check (
    agency_account_id is not null
    and is_agency_member(agency_account_id)
    and created_by is null
    and (quote_case_id is null or exists (
      select 1 from quote_cases qc
      where qc.id = workflow_threads.quote_case_id
        and qc.agency_account_id = workflow_threads.agency_account_id
    ))
    and (reservation_id is null or exists (
      select 1 from reservations r
      where r.id = workflow_threads.reservation_id
        and r.agency_account_id = workflow_threads.agency_account_id
    ))
    and (agency_inquiry_id is null or exists (
      select 1 from agency_inquiries ai
      where ai.id = workflow_threads.agency_inquiry_id
        and ai.agency_account_id = workflow_threads.agency_account_id
    ))
    and (current_invoice_id is null or exists (
      select 1 from invoices i
      join reservations r2 on r2.id = i.reservation_id
      where i.id = workflow_threads.current_invoice_id
        and r2.agency_account_id = workflow_threads.agency_account_id
    ))
  );

drop policy if exists "workflow threads agency update" on workflow_threads;
create policy "workflow threads agency update"
  on workflow_threads
  for update
  using (agency_account_id is not null and is_agency_member(agency_account_id))
  with check (agency_account_id is not null and is_agency_member(agency_account_id));

create or replace function guard_workflow_thread_agency_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jht_is_privileged_session() or has_internal_role() then
    return new;
  end if;
  if new.workflow_code is distinct from old.workflow_code
     or new.agency_account_id is distinct from old.agency_account_id
     or new.agency_inquiry_id is distinct from old.agency_inquiry_id
     or new.quote_case_id is distinct from old.quote_case_id
     or new.reservation_id is distinct from old.reservation_id
     or new.current_invoice_id is distinct from old.current_invoice_id
     or new.title is distinct from old.title
     or new.metadata is distinct from old.metadata
     or new.created_by is distinct from old.created_by then
    raise exception 'agency users can only update workflow thread follow-up status';
  end if;
  if new.status not in ('open', 'waiting_internal') then
    raise exception 'agency users can only set workflow status to open or waiting_internal';
  end if;
  return new;
end;
$$;

revoke execute on function guard_workflow_thread_agency_update() from public;

drop trigger if exists workflow_threads_guard_agency_update on workflow_threads;
create trigger workflow_threads_guard_agency_update
  before update on workflow_threads
  for each row execute function guard_workflow_thread_agency_update();

drop policy if exists "workflow messages agency insert" on workflow_messages;
create policy "workflow messages agency insert"
  on workflow_messages
  for insert
  with check (
    sender_type = 'agency'
    and visibility = 'partner_visible'
    and created_by is null
    and sender_profile_id is null
    and exists (
      select 1 from workflow_threads wt
      where wt.id = workflow_messages.workflow_thread_id
        and wt.agency_account_id is not null
        and is_agency_member(wt.agency_account_id)
    )
    and (sender_agency_user_id is null or exists (
      select 1 from agency_users au
      where au.id = workflow_messages.sender_agency_user_id
        and au.auth_user_id = auth.uid()
    ))
    and (linked_quote_version_id is null or exists (
      select 1 from quote_versions qv
      join quote_cases qc on qc.id = qv.quote_case_id
      where qv.id = workflow_messages.linked_quote_version_id
        and is_agency_member(qc.agency_account_id)
    ))
    and (linked_invoice_id is null or exists (
      select 1 from invoices i
      join reservations r on r.id = i.reservation_id
      where i.id = workflow_messages.linked_invoice_id
        and is_agency_member(r.agency_account_id)
    ))
  );

drop policy if exists "workflow attachments agency insert" on workflow_attachments;
create policy "workflow attachments agency insert"
  on workflow_attachments
  for insert
  with check (
    visibility = 'partner_visible'
    and uploaded_by is null
    and exists (
      select 1 from workflow_messages wm
      join workflow_threads wt on wt.id = wm.workflow_thread_id
      where wm.id = workflow_attachments.workflow_message_id
        and wm.sender_type = 'agency'
        and wt.agency_account_id is not null
        and is_agency_member(wt.agency_account_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 14) 에이전시 로그인 이벤트: 같은 에이전시 내 타인 명의 이벤트 위조를 차단합니다.
-- ---------------------------------------------------------------------------

drop policy if exists "agency login events agency insert" on agency_login_events;
create policy "agency login events agency insert"
  on agency_login_events
  for insert
  with check (
    is_agency_member(agency_account_id)
    and (auth_user_id is null or auth_user_id = auth.uid())
    and (agency_user_id is null or exists (
      select 1 from agency_users au
      where au.id = agency_login_events.agency_user_id
        and au.auth_user_id = auth.uid()
    ))
  );

-- ---------------------------------------------------------------------------
-- 15) 루밍리스트 재업로드 지원: 에이전시가 자기 예약의 승객 행을 갱신/정리할 수 있어야
--     리비전 업서트가 동작합니다(기존에는 insert 정책만 있어 재업로드가 실패).
-- ---------------------------------------------------------------------------

drop policy if exists "passengers agency update" on passengers;
create policy "passengers agency update"
  on passengers
  for update
  using (can_access_reservation(reservation_id))
  with check (can_access_reservation(reservation_id));

drop policy if exists "passengers agency delete" on passengers;
create policy "passengers agency delete"
  on passengers
  for delete
  using (can_access_reservation(reservation_id));

-- ---------------------------------------------------------------------------
-- 16) 수신 원장 명명 정리: 금지된 generic partner 명명을 agency 계열로 교체합니다.
--     (이 테이블은 아직 앱 코드가 사용하지 않는 스키마 선행분입니다.)
-- ---------------------------------------------------------------------------

alter table if exists partner_receivable_ledger rename to agency_receivable_ledger;
alter table if exists agency_receivable_ledger rename column partner_name to counterparty_agency_name;

-- CSV 재임포트가 수신 잔액을 중복 적재하지 않게 임포트 키를 유니크로 강제합니다.
create unique index if not exists agency_receivable_ledger_import_uidx
  on agency_receivable_ledger (
    source_file_name,
    source_year,
    coalesce(country_bucket, ''),
    counterparty_agency_name,
    currency
  );

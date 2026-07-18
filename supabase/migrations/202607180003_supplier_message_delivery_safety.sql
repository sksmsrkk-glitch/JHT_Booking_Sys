-- @file 한글 책임: Supabase 마이그레이션 `supplier message delivery safety`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

-- 공급자에게 이미 제출되었거나 발송된 증거가 있는 메시지를 다시 대기열에 넣으면
-- 외부 채널에서 동일 메시지가 중복 발송될 수 있습니다. API 검증과 별개로 DB에서도 재대기를 차단합니다.
create or replace function public.prevent_delivered_supplier_message_requeue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'failed'
     and new.status = 'queued'
     and (old.provider_message_id is not null or old.sent_at is not null) then
    raise exception 'A supplier message with delivery evidence cannot be requeued'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_message_prevent_delivered_requeue on public.supplier_message_outbox;
create trigger supplier_message_prevent_delivered_requeue
before update of status on public.supplier_message_outbox
for each row
execute function public.prevent_delivered_supplier_message_requeue();

revoke all on function public.prevent_delivered_supplier_message_requeue() from public, anon, authenticated;
grant execute on function public.prevent_delivered_supplier_message_requeue() to service_role;

-- 워커의 최종 상태와 감사 로그를 한 트랜잭션에서 기록합니다.
-- Node와 향후 Java 워커 모두 이 RPC만 호출하므로 완료 상태와 이력의 불일치를 방지합니다.

create or replace function finish_quote_export_job(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_storage_path text default null,
  p_error_message text default null
)
returns quote_exports
language plpgsql
security invoker
set search_path = public
as $$
declare
  job_row quote_exports%rowtype;
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'Worker completion status must be completed or failed' using errcode = '22023';
  end if;

  update quote_exports
  set status = p_status,
      storage_path = case when p_status = 'completed' then coalesce(p_storage_path, storage_path) else storage_path end,
      error_message = case when p_status = 'failed' then p_error_message else null end,
      locked_at = null,
      locked_by = null,
      lease_expires_at = null
  where id = p_job_id
    and status = 'processing'
    and locked_by = btrim(p_worker_id)
  returning * into job_row;

  if not found then
    raise exception 'Quote export lease is missing or owned by another worker' using errcode = '55000';
  end if;

  insert into audit_logs(action, entity_table, entity_id, after_data)
  values (
    case when p_status = 'completed' then 'quote_export.completed' else 'quote_export.failed' end,
    'quote_exports',
    job_row.id,
    jsonb_strip_nulls(jsonb_build_object(
      'quoteVersionId', job_row.quote_version_id,
      'exportType', job_row.export_type,
      'storagePath', job_row.storage_path,
      'error', job_row.error_message,
      'workerId', btrim(p_worker_id),
      'attemptCount', job_row.attempt_count
    ))
  );

  return job_row;
end;
$$;

revoke all on function finish_quote_export_job(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function finish_quote_export_job(uuid, text, text, text, text) to service_role;

-- XLSX/PDF/대량 변환처럼 CPU·메모리 사용이 큰 작업은 웹 요청과 분리합니다.
-- 이 lease 기반 계약은 현재 Node worker와 향후 Java worker가 동일하게 사용할 수 있습니다.

alter table quote_exports
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

-- 구버전 worker가 남긴 processing 행에는 lease가 없으므로 배포 즉시 다시 처리 가능하게 복구합니다.
update quote_exports
set status = 'queued',
    locked_at = null,
    locked_by = null,
    lease_expires_at = null
where status = 'processing'
  and lease_expires_at is null;

create index if not exists quote_exports_worker_queue_idx
  on quote_exports(status, lease_expires_at, created_at)
  where status in ('queued', 'processing');

create or replace function claim_quote_export_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns setof quote_exports
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'workerId is required' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select id
    from quote_exports
    where export_type = 'xlsx'
      and (
        status = 'queued'
        or (status = 'processing' and lease_expires_at < now())
      )
    order by created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update quote_exports jobs
  set status = 'processing',
      locked_at = now(),
      locked_by = btrim(p_worker_id),
      lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 3600))),
      attempt_count = jobs.attempt_count + 1,
      error_message = null
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

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
  return job_row;
end;
$$;

revoke all on function claim_quote_export_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function finish_quote_export_job(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function claim_quote_export_jobs(text, integer, integer) to service_role;
grant execute on function finish_quote_export_job(uuid, text, text, text, text) to service_role;

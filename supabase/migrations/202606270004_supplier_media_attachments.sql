-- @file 한글 책임: Supabase 마이그레이션 `supplier media attachments`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

alter table supplier_media
  alter column storage_path drop not null;

alter table supplier_media
  add column if not exists image_url text,
  add column if not exists alt_text text,
  add column if not exists sort_order integer not null default 1 check (sort_order > 0),
  add column if not exists is_public boolean not null default true,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'supplier_media_has_image_source'
  ) then
    alter table supplier_media
      add constraint supplier_media_has_image_source
      check (storage_path is not null or image_url is not null);
  end if;
end $$;

create index if not exists supplier_media_product_sort_idx
  on supplier_media(supplier_product_id, media_type, sort_order);

create or replace function enforce_supplier_media_image_limit()
returns trigger
language plpgsql
as $$
declare
  image_count integer;
begin
  if new.media_type <> 'image' then
    return new;
  end if;

  if new.supplier_product_id is not null then
    select count(*)
      into image_count
      from supplier_media
      where supplier_product_id = new.supplier_product_id
        and media_type = 'image'
        and (tg_op = 'INSERT' or id <> new.id);

    if image_count >= 10 then
      raise exception 'supplier product image limit exceeded: max 10 images per item';
    end if;
  elsif new.domestic_supplier_id is not null then
    select count(*)
      into image_count
      from supplier_media
      where domestic_supplier_id = new.domestic_supplier_id
        and supplier_product_id is null
        and media_type = 'image'
        and (tg_op = 'INSERT' or id <> new.id);

    if image_count >= 10 then
      raise exception 'domestic supplier image limit exceeded: max 10 profile images';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_media_image_limit on supplier_media;
create trigger supplier_media_image_limit
  before insert or update on supplier_media
  for each row
  execute function enforce_supplier_media_image_limit();

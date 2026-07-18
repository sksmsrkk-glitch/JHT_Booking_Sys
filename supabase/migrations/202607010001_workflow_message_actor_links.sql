-- @file 한글 책임: Supabase 마이그레이션 `workflow message actor links`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.
-- 운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.

alter table workflow_messages
  add column if not exists sender_profile_id uuid references profiles(id) on delete set null,
  add column if not exists sender_agency_user_id uuid references agency_users(id) on delete set null;

create index if not exists workflow_messages_sender_profile_idx
  on workflow_messages(sender_profile_id, created_at desc);

create index if not exists workflow_messages_sender_agency_user_idx
  on workflow_messages(sender_agency_user_id, created_at desc);

-- 기존 내부 메시지는 created_by에 내부 profile id가 남아 있으므로 작성자 FK로 보정합니다.
update workflow_messages
set sender_profile_id = created_by
where sender_profile_id is null
  and sender_type = 'internal'
  and created_by is not null;

-- 기존 내부 메시지의 표시 이름/이메일도 profile 기준으로 가능한 범위에서 정리합니다.
update workflow_messages wm
set
  sender_name = coalesce(nullif(wm.sender_name, 'JHT Internal'), p.display_name, p.email, wm.sender_name),
  sender_email = coalesce(wm.sender_email, p.email)
from profiles p
where wm.sender_profile_id = p.id
  and wm.sender_type = 'internal';

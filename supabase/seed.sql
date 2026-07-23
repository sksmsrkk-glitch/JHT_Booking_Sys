-- @file 한글 책임: 로컬 개발과 통합 검증에 필요한 기준 데이터와 업무 시나리오를 재현 가능한 식별자로 구성합니다.
-- 운영 데이터로 오인되지 않도록 호스팅 환경 보호 규칙과 업무 테이블 간 참조 순서를 함께 유지합니다.

-- Local v1 demo seed for Jungho Travel operations.
-- This file is safe to run repeatedly in local Supabase because rows use stable IDs.

-- Hosted guard: this seed creates demo auth users with a repo-known password.
-- Hosted Supabase connections use SSL, so we refuse to run there by default.
-- Local docker connections are plain TCP and pass this check unchanged.
do $$
declare
  v_ssl boolean;
begin
  select coalesce(s.ssl, false) into v_ssl
  from pg_stat_ssl s
  where s.pid = pg_backend_pid();
  if v_ssl and coalesce(current_setting('app.jht_allow_demo_seed', true), '') <> 'on' then
    raise exception 'JHT demo seed refused on an SSL (hosted) connection. Set app.jht_allow_demo_seed to on for this session only if you really intend to load demo users.';
  end if;
end $$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone,
  phone_change,
  phone_change_token,
  email_change_token_current,
  reauthentication_token,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000002001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'demo-admin@junghotravel.local',
    crypt('JhtDemo!2026', gen_salt('bf')),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"JHT Demo Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'agency-user@worldtravellers.example',
    crypt('AgencyDemo!2026', gen_salt('bf')),
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    '',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Alicia Tan"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  phone = excluded.phone,
  phone_change = excluded.phone_change,
  phone_change_token = excluded.phone_change_token,
  email_change_token_current = excluded.email_change_token_current,
  reauthentication_token = excluded.reauthentication_token,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into companies (id, code, name_ko, name_en, status)
values
  ('00000000-0000-4000-8000-000000001001', 'JHT', 'Jungho Travel', 'Jungho Travel Service', 'active'),
  ('00000000-0000-4000-8000-000000001002', 'AMT', 'AllMyTour', 'AllMyTour', 'active')
on conflict (id) do update set
  code = excluded.code,
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  status = excluded.status;

insert into profiles (id, email, display_name, default_company_id, status)
values
  (
    '00000000-0000-4000-8000-000000002001',
    'demo-admin@junghotravel.local',
    'JHT Demo Admin',
    '00000000-0000-4000-8000-000000001001',
    'active'
  )
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  default_company_id = excluded.default_company_id,
  status = excluded.status;

insert into user_roles (user_id, role, team)
values
  ('00000000-0000-4000-8000-000000002001', 'admin', null),
  ('00000000-0000-4000-8000-000000002001', 'sales', 'sales'),
  ('00000000-0000-4000-8000-000000002001', 'operations', 'operations'),
  ('00000000-0000-4000-8000-000000002001', 'finance', 'finance')
on conflict (user_id, role) do update set
  team = excluded.team;

insert into agency_accounts (
  id,
  company_id,
  name,
  country_code,
  email_domain,
  phone,
  website,
  billing_currency,
  status
)
values (
  '00000000-0000-4000-8000-000000003001',
  '00000000-0000-4000-8000-000000001001',
  'World Travellers DMC',
  'MY',
  'worldtravellers.example',
  '+60-3-0000-1000',
  'https://worldtravellers.example',
  'MYR',
  'active'
)
on conflict (id) do update set
  name = excluded.name,
  country_code = excluded.country_code,
  email_domain = excluded.email_domain,
  phone = excluded.phone,
  website = excluded.website,
  billing_currency = excluded.billing_currency,
  status = excluded.status;

insert into agency_users (id, agency_account_id, auth_user_id, email, name, title, is_account_admin, status)
values (
  '00000000-0000-4000-8000-000000003101',
  '00000000-0000-4000-8000-000000003001',
  '00000000-0000-4000-8000-000000002002',
  'agency-user@worldtravellers.example',
  'Alicia Tan',
  'Senior Product Manager',
  true,
  'active'
)
on conflict (id) do update set
  auth_user_id = excluded.auth_user_id,
  email = excluded.email,
  name = excluded.name,
  title = excluded.title,
  is_account_admin = excluded.is_account_admin,
  status = excluded.status;

insert into agency_contacts (
  id,
  agency_account_id,
  name,
  email,
  phone,
  role,
  receives_quotes,
  receives_invoices,
  status
)
values (
  '00000000-0000-4000-8000-000000003201',
  '00000000-0000-4000-8000-000000003001',
  'Alicia Tan',
  'agency-user@worldtravellers.example',
  '+60-12-0000-2000',
  'Product',
  true,
  true,
  'active'
)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  role = excluded.role,
  receives_quotes = excluded.receives_quotes,
  receives_invoices = excluded.receives_invoices,
  status = excluded.status;

insert into domestic_suppliers (
  id,
  company_id,
  category,
  name_ko,
  name_en,
  search_keywords,
  region_level1,
  region_level2,
  phone,
  status
)
values
  (
    '00000000-0000-4000-8000-000000004001',
    '00000000-0000-4000-8000-000000001001',
    'hotel',
    'Lotte Hotel Busan',
    'Lotte Hotel Busan',
    'busan hotel deluxe twin',
    'Busan',
    'Busanjin-gu',
    '+82-51-000-1000',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000004002',
    '00000000-0000-4000-8000-000000001001',
    'restaurant',
    'Daegemanchan',
    'Daegemanchan',
    'busan seafood restaurant',
    'Busan',
    'Haeundae-gu',
    '+82-51-000-2000',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000004003',
    '00000000-0000-4000-8000-000000001001',
    'vehicle',
    'Seoul Premium Coach',
    'Seoul Premium Coach',
    'coach bus seoul busan',
    'Seoul',
    'Jung-gu',
    '+82-2-000-3000',
    'active'
  )
on conflict (id) do update set
  category = excluded.category,
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  search_keywords = excluded.search_keywords,
  region_level1 = excluded.region_level1,
  region_level2 = excluded.region_level2,
  phone = excluded.phone,
  status = excluded.status;

insert into supplier_contacts (id, domestic_supplier_id, name, title, email, phone, kakao_available, status)
values
  (
    '00000000-0000-4000-8000-000000004101',
    '00000000-0000-4000-8000-000000004001',
    'Hotel Sales Desk',
    'Reservation',
    'sales@lottehotelbusan.example',
    '+82-51-000-1100',
    false,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000004102',
    '00000000-0000-4000-8000-000000004002',
    'Restaurant Booking Desk',
    'Manager',
    'booking@daegemanchan.example',
    '+82-51-000-2100',
    true,
    'active'
  )
on conflict (id) do update set
  name = excluded.name,
  title = excluded.title,
  email = excluded.email,
  phone = excluded.phone,
  kakao_available = excluded.kakao_available,
  status = excluded.status;

insert into supplier_products (
  id,
  domestic_supplier_id,
  product_type,
  name_ko,
  name_en,
  search_name,
  description,
  capacity,
  room_type,
  breakfast_included,
  vehicle_seat_count,
  menu_tags,
  status
)
values
  (
    '00000000-0000-4000-8000-000000005001',
    '00000000-0000-4000-8000-000000004001',
    'room',
    'Deluxe Twin',
    'Deluxe Twin',
    'Lotte Hotel Busan Deluxe Twin',
    'Demo hotel room product for v1 quote snapshots.',
    2,
    'TWIN',
    true,
    null,
    null,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000005002',
    '00000000-0000-4000-8000-000000004002',
    'meal',
    'Seafood Course',
    'Seafood Course',
    'Daegemanchan Seafood Course',
    'Demo restaurant course menu.',
    null,
    null,
    null,
    null,
    array['seafood', 'group'],
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000005003',
    '00000000-0000-4000-8000-000000004003',
    'vehicle',
    '45 Seat Coach',
    '45 Seat Coach',
    'Seoul Premium Coach 45 Seat',
    'Demo coach product.',
    null,
    null,
    null,
    45,
    null,
    'active'
  )
on conflict (id) do update set
  product_type = excluded.product_type,
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  search_name = excluded.search_name,
  description = excluded.description,
  capacity = excluded.capacity,
  room_type = excluded.room_type,
  breakfast_included = excluded.breakfast_included,
  vehicle_seat_count = excluded.vehicle_seat_count,
  menu_tags = excluded.menu_tags,
  status = excluded.status;

insert into supplier_prices (
  id,
  supplier_product_id,
  pricing_unit,
  currency,
  cost_amount,
  min_pax,
  max_pax,
  season_label,
  valid_from,
  valid_to,
  includes_tax,
  status
)
values
  (
    '00000000-0000-4000-8000-000000006001',
    '00000000-0000-4000-8000-000000005001',
    'per_room',
    'KRW',
    209000,
    null,
    null,
    '2026 demo weekday',
    '2026-01-01',
    '2026-12-31',
    true,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000006002',
    '00000000-0000-4000-8000-000000005002',
    'per_person',
    'KRW',
    60000,
    10,
    80,
    '2026 demo group',
    '2026-01-01',
    '2026-12-31',
    true,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000006003',
    '00000000-0000-4000-8000-000000005003',
    'per_day',
    'KRW',
    750000,
    null,
    null,
    '2026 demo coach',
    '2026-01-01',
    '2026-12-31',
    true,
    'active'
  )
on conflict (id) do update set
  pricing_unit = excluded.pricing_unit,
  currency = excluded.currency,
  cost_amount = excluded.cost_amount,
  min_pax = excluded.min_pax,
  max_pax = excluded.max_pax,
  season_label = excluded.season_label,
  valid_from = excluded.valid_from,
  valid_to = excluded.valid_to,
  includes_tax = excluded.includes_tax,
  status = excluded.status;

insert into agency_inquiries (
  id,
  agency_account_id,
  submitted_by_agency_user_id,
  inquiry_type,
  title,
  requested_start_date,
  requested_end_date,
  pax_count,
  preferred_language,
  tour_type,
  source_channel,
  tour_code,
  request_payload,
  status
)
values (
  '00000000-0000-4000-8000-000000007001',
  '00000000-0000-4000-8000-000000003001',
  '00000000-0000-4000-8000-000000003101',
  'new_inquiry',
  'Seoul and Busan incentive tour',
  '2026-09-10',
  '2026-09-13',
  20,
  'English',
  'incentive_tour',
  'portal',
  'MY-WORLDTRAVE-20260627-A1B2C3',
  '{"notes":"Demo inquiry for v1 local verification."}'::jsonb,
  'quoted'
)
on conflict (id) do update set
  title = excluded.title,
  requested_start_date = excluded.requested_start_date,
  requested_end_date = excluded.requested_end_date,
  pax_count = excluded.pax_count,
  preferred_language = excluded.preferred_language,
  tour_type = excluded.tour_type,
  tour_code = excluded.tour_code,
  request_payload = excluded.request_payload,
  status = excluded.status;

insert into quote_cases (
  id,
  company_id,
  agency_account_id,
  agency_inquiry_id,
  case_code,
  share_id,
  tour_name,
  tour_type,
  status,
  currency,
  estimated_pax,
  start_date,
  end_date,
  gmail_thread_id,
  internal_owner_id
)
values (
  '00000000-0000-4000-8000-000000008001',
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-4000-8000-000000003001',
  '00000000-0000-4000-8000-000000007001',
  'MY-WORLDTRAVE-20260627-A1B2C3',
  'demo-seoul-busan-incentive',
  'Seoul and Busan Incentive',
  'incentive_tour',
  'accepted',
  'KRW',
  20,
  '2026-09-10',
  '2026-09-13',
  'gmail-demo-thread-001',
  '00000000-0000-4000-8000-000000002001'
)
on conflict (id) do update set
  agency_inquiry_id = excluded.agency_inquiry_id,
  case_code = excluded.case_code,
  share_id = excluded.share_id,
  tour_name = excluded.tour_name,
  tour_type = excluded.tour_type,
  status = excluded.status,
  currency = excluded.currency,
  estimated_pax = excluded.estimated_pax,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  gmail_thread_id = excluded.gmail_thread_id,
  internal_owner_id = excluded.internal_owner_id;

update agency_inquiries
set related_quote_case_id = '00000000-0000-4000-8000-000000008001'
where id = '00000000-0000-4000-8000-000000007001';

insert into quote_versions (
  id,
  quote_case_id,
  version_no,
  status,
  margin_mode,
  currency,
  exchange_rate_to_krw,
  agency_visible_summary,
  public_total_amount,
  terms_and_conditions,
  created_by,
  sent_at,
  accepted_at
)
values (
  '00000000-0000-4000-8000-000000008101',
  '00000000-0000-4000-8000-000000008001',
  1,
  'accepted',
  'auto_rate',
  'KRW',
  1,
  '{"highlights":["Seoul arrival","Busan hotel","Seafood dinner"],"pax":20}'::jsonb,
  5740000,
  'Demo terms: rates are sample only and subject to supplier confirmation.',
  '00000000-0000-4000-8000-000000002001',
  '2026-06-26 09:00:00+00',
  '2026-06-27 09:00:00+00'
)
on conflict (id) do update set
  status = excluded.status,
  agency_visible_summary = excluded.agency_visible_summary,
  public_total_amount = excluded.public_total_amount,
  terms_and_conditions = excluded.terms_and_conditions,
  sent_at = excluded.sent_at,
  accepted_at = excluded.accepted_at;

-- 내부 원가/마진/기본 마진율은 agency 비노출 테이블에 별도로 넣습니다.
insert into quote_version_internals (
  quote_version_id,
  internal_total_cost_krw,
  internal_total_margin_krw,
  default_margin_rate
)
values (
  '00000000-0000-4000-8000-000000008101',
  4790000,
  950000,
  0.2
)
on conflict (quote_version_id) do update set
  internal_total_cost_krw = excluded.internal_total_cost_krw,
  internal_total_margin_krw = excluded.internal_total_margin_krw,
  default_margin_rate = excluded.default_margin_rate;

insert into quote_itinerary_days (
  id,
  quote_version_id,
  day_no,
  service_date,
  title,
  meal_summary,
  public_description
)
values
  (
    '00000000-0000-4000-8000-000000008201',
    '00000000-0000-4000-8000-000000008101',
    1,
    '2026-09-10',
    'Arrival in Seoul',
    '{"lunch":"own arrangement","dinner":"welcome dinner"}'::jsonb,
    'Airport arrival, guide meet-and-greet, and transfer to hotel.'
  ),
  (
    '00000000-0000-4000-8000-000000008202',
    '00000000-0000-4000-8000-000000008101',
    2,
    '2026-09-11',
    'Busan program',
    '{"lunch":"local restaurant","dinner":"seafood course"}'::jsonb,
    'KTX to Busan, hotel check-in, and seafood dinner.'
  )
on conflict (id) do update set
  service_date = excluded.service_date,
  title = excluded.title,
  meal_summary = excluded.meal_summary,
  public_description = excluded.public_description;

-- 내부 메모는 파트너 비노출 테이블에 저장합니다.
insert into quote_itinerary_day_internals (quote_itinerary_day_id, internal_notes)
values
  ('00000000-0000-4000-8000-000000008201', 'Confirm coach parking permit before arrival.'),
  ('00000000-0000-4000-8000-000000008202', 'Restaurant requires final pax 7 days prior.')
on conflict (quote_itinerary_day_id) do update set
  internal_notes = excluded.internal_notes;

insert into route_segments (
  id,
  quote_itinerary_day_id,
  seq,
  origin_label,
  destination_label,
  travel_minutes,
  distance_meters,
  provider,
  provider_payload,
  manual_override
)
values
  (
    '00000000-0000-4000-8000-000000008301',
    '00000000-0000-4000-8000-000000008201',
    1,
    'ICN Airport',
    'Seoul Hotel',
    70,
    62000,
    'manual',
    '{"demo":true}'::jsonb,
    true
  ),
  (
    '00000000-0000-4000-8000-000000008302',
    '00000000-0000-4000-8000-000000008202',
    1,
    'Busan Station',
    'Lotte Hotel Busan',
    25,
    9000,
    'manual',
    '{"demo":true}'::jsonb,
    true
  )
on conflict (id) do update set
  origin_label = excluded.origin_label,
  destination_label = excluded.destination_label,
  travel_minutes = excluded.travel_minutes,
  distance_meters = excluded.distance_meters,
  provider = excluded.provider,
  provider_payload = excluded.provider_payload,
  manual_override = excluded.manual_override;

insert into quote_items (
  id,
  quote_version_id,
  itinerary_day_id,
  source_supplier_product_id,
  source_supplier_price_id,
  item_category,
  snapshot_item_name,
  snapshot_supplier_name,
  snapshot_cost_currency,
  snapshot_unit_cost_amount,
  exchange_rate_to_krw,
  pricing_unit,
  quantity,
  pax_count,
  margin_mode,
  margin_rate,
  total_cost_krw,
  total_sell_amount,
  partner_visible_notes,
  internal_notes
)
values
  (
    '00000000-0000-4000-8000-000000008401',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008202',
    '00000000-0000-4000-8000-000000005001',
    '00000000-0000-4000-8000-000000006001',
    'room',
    'Deluxe Twin',
    'Lotte Hotel Busan',
    'KRW',
    209000,
    1,
    'per_room',
    10,
    20,
    'auto_rate',
    0.1962,
    2090000,
    2500000,
    'Twin-share accommodation with breakfast.',
    'Demo hotel cost snapshot.'
  ),
  (
    '00000000-0000-4000-8000-000000008402',
    '00000000-0000-4000-8000-000000008101',
    '00000000-0000-4000-8000-000000008202',
    '00000000-0000-4000-8000-000000005002',
    '00000000-0000-4000-8000-000000006002',
    'meal',
    'Seafood Course',
    'Daegemanchan',
    'KRW',
    60000,
    1,
    'per_person',
    20,
    20,
    'auto_rate',
    0.2,
    1200000,
    1440000,
    'Group seafood course dinner.',
    'Demo restaurant cost snapshot.'
  ),
  (
    '00000000-0000-4000-8000-000000008403',
    '00000000-0000-4000-8000-000000008101',
    null,
    '00000000-0000-4000-8000-000000005003',
    '00000000-0000-4000-8000-000000006003',
    'vehicle',
    '45 Seat Coach',
    'Seoul Premium Coach',
    'KRW',
    750000,
    1,
    'per_day',
    2,
    20,
    'auto_rate',
    0.2,
    1500000,
    1800000,
    'Private coach for transfers and program movement.',
    'Demo vehicle cost snapshot.'
  )
on conflict (id) do update set
  itinerary_day_id = excluded.itinerary_day_id,
  snapshot_item_name = excluded.snapshot_item_name,
  snapshot_supplier_name = excluded.snapshot_supplier_name,
  snapshot_unit_cost_amount = excluded.snapshot_unit_cost_amount,
  quantity = excluded.quantity,
  pax_count = excluded.pax_count,
  margin_rate = excluded.margin_rate,
  total_cost_krw = excluded.total_cost_krw,
  total_sell_amount = excluded.total_sell_amount,
  partner_visible_notes = excluded.partner_visible_notes,
  internal_notes = excluded.internal_notes;

insert into quote_exports (id, quote_version_id, export_type, storage_path, status, error_message, created_by, created_at)
values
  (
    '00000000-0000-4000-8000-000000008501',
    '00000000-0000-4000-8000-000000008101',
    'xlsx',
    'quote-exports/00000000-0000-4000-8000-000000008101/demo-export.xlsx',
    'completed',
    null,
    '00000000-0000-4000-8000-000000002001',
    '2026-06-27 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000008502',
    '00000000-0000-4000-8000-000000008101',
    'xlsx',
    'quote-exports/00000000-0000-4000-8000-000000008101/demo-retry.xlsx',
    'failed',
    'Demo storage timeout for failed jobs view',
    '00000000-0000-4000-8000-000000002001',
    '2026-06-27 10:10:00+00'
  )
on conflict (id) do update set
  storage_path = excluded.storage_path,
  status = excluded.status,
  error_message = excluded.error_message,
  created_by = excluded.created_by,
  created_at = excluded.created_at;

insert into reservations (
  id,
  quote_case_id,
  accepted_quote_version_id,
  reservation_code,
  agency_account_id,
  status,
  tour_start_date,
  tour_end_date,
  confirmed_at
)
values (
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000008001',
  '00000000-0000-4000-8000-000000008101',
  'MY-WORLDTRAVE-20260627-A1B2C3',
  '00000000-0000-4000-8000-000000003001',
  'confirmed',
  '2026-09-10',
  '2026-09-13',
  '2026-06-27 09:30:00+00'
)
on conflict (id) do update set
  accepted_quote_version_id = excluded.accepted_quote_version_id,
  reservation_code = excluded.reservation_code,
  status = excluded.status,
  tour_start_date = excluded.tour_start_date,
  tour_end_date = excluded.tour_end_date,
  confirmed_at = excluded.confirmed_at;

insert into reservation_status_history (id, reservation_id, from_status, to_status, reason, changed_by, created_at)
values (
  '00000000-0000-4000-8000-000000009101',
  '00000000-0000-4000-8000-000000009001',
  'pending',
  'confirmed',
  'Demo reservation confirmed from accepted quote.',
  '00000000-0000-4000-8000-000000002001',
  '2026-06-27 09:30:00+00'
)
on conflict (id) do update set
  reason = excluded.reason,
  changed_by = excluded.changed_by,
  created_at = excluded.created_at;

insert into rooming_lists (
  id,
  reservation_id,
  uploaded_by_agency_user_id,
  original_filename,
  storage_path,
  revision_no,
  parsed_status,
  idempotency_key
)
values (
  '00000000-0000-4000-8000-000000009201',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000003101',
  'demo-rooming-list.csv',
  'rooming-lists/RSV-2026-DEMO-001/demo-rooming-list.csv',
  1,
  'parsed',
  'demo-rooming-list-rsv-001-v1'
)
on conflict (id) do update set
  original_filename = excluded.original_filename,
  storage_path = excluded.storage_path,
  parsed_status = excluded.parsed_status,
  idempotency_key = excluded.idempotency_key;

insert into passengers (
  id,
  reservation_id,
  rooming_list_id,
  passenger_no,
  full_name,
  gender,
  date_of_birth,
  dietary_requirements,
  passport_no,
  coach_label
)
values
  (
    '00000000-0000-4000-8000-000000009301',
    '00000000-0000-4000-8000-000000009001',
    '00000000-0000-4000-8000-000000009201',
    '1',
    'Demo Guest One',
    'F',
    '1990-01-15',
    'No beef',
    'DEMO-PASSPORT-1',
    'A'
  ),
  (
    '00000000-0000-4000-8000-000000009302',
    '00000000-0000-4000-8000-000000009001',
    '00000000-0000-4000-8000-000000009201',
    '2',
    'Demo Guest Two',
    'M',
    '1988-05-20',
    null,
    'DEMO-PASSPORT-2',
    'A'
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  gender = excluded.gender,
  date_of_birth = excluded.date_of_birth,
  dietary_requirements = excluded.dietary_requirements,
  passport_no = excluded.passport_no,
  coach_label = excluded.coach_label;

insert into room_assignments (
  id,
  reservation_id,
  rooming_list_id,
  room_no,
  room_type,
  passenger_ids,
  check_in,
  check_out,
  notes
)
values (
  '00000000-0000-4000-8000-000000009401',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009201',
  'TBA-1',
  'TWIN',
  array[
    '00000000-0000-4000-8000-000000009301'::uuid,
    '00000000-0000-4000-8000-000000009302'::uuid
  ],
  '2026-09-11',
  '2026-09-13',
  'Demo twin room assignment.'
)
on conflict (id) do update set
  room_no = excluded.room_no,
  room_type = excluded.room_type,
  passenger_ids = excluded.passenger_ids,
  check_in = excluded.check_in,
  check_out = excluded.check_out,
  notes = excluded.notes;

insert into operation_tasks (
  id,
  reservation_id,
  domestic_supplier_id,
  team,
  task_type,
  title,
  status,
  assigned_to,
  due_at,
  blocked_reason,
  created_by
)
values
  (
    '00000000-0000-4000-8000-000000009501',
    '00000000-0000-4000-8000-000000009001',
    '00000000-0000-4000-8000-000000004001',
    'hotel_booking',
    'hotel_booking',
    'Confirm Busan hotel rooms',
    'blocked',
    '00000000-0000-4000-8000-000000002001',
    '2026-08-10 09:00:00+00',
    'Waiting for supplier allotment confirmation.',
    '00000000-0000-4000-8000-000000002001'
  ),
  (
    '00000000-0000-4000-8000-000000009502',
    '00000000-0000-4000-8000-000000009001',
    '00000000-0000-4000-8000-000000004003',
    'vehicle_booking',
    'vehicle_booking',
    'Reserve 45 seat coach',
    'todo',
    '00000000-0000-4000-8000-000000002001',
    '2026-08-05 09:00:00+00',
    null,
    '00000000-0000-4000-8000-000000002001'
  )
on conflict (id) do update set
  domestic_supplier_id = excluded.domestic_supplier_id,
  team = excluded.team,
  task_type = excluded.task_type,
  title = excluded.title,
  status = excluded.status,
  assigned_to = excluded.assigned_to,
  due_at = excluded.due_at,
  blocked_reason = excluded.blocked_reason,
  created_by = excluded.created_by;

insert into supplier_message_templates (
  id,
  company_id,
  supplier_category,
  message_type,
  channel,
  locale,
  subject_template,
  body_template,
  active
)
values (
  '00000000-0000-4000-8000-000000009601',
  '00000000-0000-4000-8000-000000001001',
  'hotel',
  'booking_request',
  'email',
  'en-US',
  '[{{reservation.code}}] Booking request - {{reservation.tourName}}',
  'Dear {{supplier.name}}, please confirm the demo booking request.',
  true
)
on conflict (id) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  active = excluded.active;

insert into supplier_message_outbox (
  id,
  reservation_id,
  domestic_supplier_id,
  supplier_contact_id,
  template_id,
  message_type,
  channel,
  risk_level,
  status,
  subject,
  body,
  idempotency_key,
  approved_by,
  approved_at,
  error_message,
  metadata,
  created_by
)
values (
  '00000000-0000-4000-8000-000000009701',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000004101',
  '00000000-0000-4000-8000-000000009601',
  'booking_request',
  'email',
  'normal',
  'failed',
  '[RSV-2026-DEMO-001] Booking request - Seoul and Busan Incentive',
  'Dear Lotte Hotel Busan, please confirm demo room availability for 10 twin rooms.',
  'demo:rsv-2026-demo-001:hotel:booking-request:email:v1',
  '00000000-0000-4000-8000-000000002001',
  '2026-06-27 10:20:00+00',
  'Demo provider timeout for failed jobs view',
  '{"demo":true}'::jsonb,
  '00000000-0000-4000-8000-000000002001'
)
on conflict (id) do update set
  supplier_contact_id = excluded.supplier_contact_id,
  template_id = excluded.template_id,
  status = excluded.status,
  subject = excluded.subject,
  body = excluded.body,
  idempotency_key = excluded.idempotency_key,
  approved_by = excluded.approved_by,
  approved_at = excluded.approved_at,
  error_message = excluded.error_message,
  metadata = excluded.metadata,
  created_by = excluded.created_by;

insert into supplier_message_events (
  id,
  supplier_message_outbox_id,
  event_type,
  provider,
  provider_payload,
  created_at
)
values (
  '00000000-0000-4000-8000-000000009711',
  '00000000-0000-4000-8000-000000009701',
  'failed',
  'email_dry_run',
  '{"demo":true,"error":"timeout"}'::jsonb,
  '2026-06-27 10:21:00+00'
)
on conflict (id) do update set
  event_type = excluded.event_type,
  provider = excluded.provider,
  provider_payload = excluded.provider_payload,
  created_at = excluded.created_at;

insert into invoices (
  id,
  reservation_id,
  invoice_no,
  status,
  currency,
  total_amount,
  issued_at,
  due_date,
  storage_path
)
values (
  '00000000-0000-4000-8000-000000009801',
  '00000000-0000-4000-8000-000000009001',
  'MY-WORLDTRAVE-20260627-A1B2C3-INV-V01',
  'partially_paid',
  'KRW',
  5740000,
  '2026-06-28 09:00:00+00',
  '2026-07-15',
  'invoices/MY-WORLDTRAVE-20260627-A1B2C3-INV-V01.pdf'
)
on conflict (id) do update set
  invoice_no = excluded.invoice_no,
  status = excluded.status,
  total_amount = excluded.total_amount,
  issued_at = excluded.issued_at,
  due_date = excluded.due_date,
  storage_path = excluded.storage_path;

insert into payments (
  id,
  invoice_id,
  status,
  currency,
  amount,
  received_at,
  method,
  reference_no,
  idempotency_key,
  created_by
)
values (
  '00000000-0000-4000-8000-000000009811',
  '00000000-0000-4000-8000-000000009801',
  'confirmed',
  'KRW',
  2000000,
  '2026-06-29 09:00:00+00',
  'bank_transfer',
  'DEMO-BANK-REF-001',
  'demo-payment-inv-2026-001-1',
  '00000000-0000-4000-8000-000000002001'
)
on conflict (id) do update set
  status = excluded.status,
  amount = excluded.amount,
  received_at = excluded.received_at,
  method = excluded.method,
  reference_no = excluded.reference_no,
  idempotency_key = excluded.idempotency_key,
  created_by = excluded.created_by;

insert into expenses (
  id,
  reservation_id,
  domestic_supplier_id,
  expense_date,
  category,
  description,
  currency,
  amount,
  receipt_storage_path,
  created_by
)
values (
  '00000000-0000-4000-8000-000000009821',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000004001',
  '2026-09-11',
  'hotel',
  'Demo hotel supplier payable',
  'KRW',
  2090000,
  'receipts/demo-hotel-payable.pdf',
  '00000000-0000-4000-8000-000000002001'
)
on conflict (id) do update set
  amount = excluded.amount,
  receipt_storage_path = excluded.receipt_storage_path,
  created_by = excluded.created_by;

insert into extra_revenues (id, reservation_id, revenue_type, description, currency, amount, created_by)
values (
  '00000000-0000-4000-8000-000000009831',
  '00000000-0000-4000-8000-000000009001',
  'upgrade_fee',
  'Demo optional upgrade revenue',
  'KRW',
  250000,
  '00000000-0000-4000-8000-000000002001'
)
on conflict (id) do update set
  revenue_type = excluded.revenue_type,
  description = excluded.description,
  amount = excluded.amount,
  created_by = excluded.created_by;

insert into shopping_commissions (
  id,
  reservation_id,
  domestic_supplier_id,
  shop_name,
  visit_date,
  sales_amount,
  commission_amount,
  currency,
  created_by
)
values (
  '00000000-0000-4000-8000-000000009841',
  '00000000-0000-4000-8000-000000009001',
  null,
  'Demo Duty Free',
  '2026-09-12',
  1500000,
  120000,
  'KRW',
  '00000000-0000-4000-8000-000000002001'
)
on conflict (id) do update set
  shop_name = excluded.shop_name,
  visit_date = excluded.visit_date,
  sales_amount = excluded.sales_amount,
  commission_amount = excluded.commission_amount,
  created_by = excluded.created_by;

insert into settlements (
  id,
  reservation_id,
  status,
  total_invoice_amount,
  total_payment_amount,
  total_expense_amount,
  total_extra_revenue_amount,
  total_shopping_commission_amount,
  final_profit_amount
)
values (
  '00000000-0000-4000-8000-000000009851',
  '00000000-0000-4000-8000-000000009001',
  'review',
  5740000,
  2000000,
  2090000,
  250000,
  120000,
  4020000
)
on conflict (id) do update set
  status = excluded.status,
  total_invoice_amount = excluded.total_invoice_amount,
  total_payment_amount = excluded.total_payment_amount,
  total_expense_amount = excluded.total_expense_amount,
  total_extra_revenue_amount = excluded.total_extra_revenue_amount,
  total_shopping_commission_amount = excluded.total_shopping_commission_amount,
  final_profit_amount = excluded.final_profit_amount;

insert into email_threads (
  id,
  gmail_thread_id,
  quote_case_id,
  reservation_id,
  agency_account_id,
  match_confidence,
  requires_manual_review
)
values (
  '00000000-0000-4000-8000-000000009901',
  'gmail-demo-thread-001',
  '00000000-0000-4000-8000-000000008001',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000003001',
  0.92,
  false
)
on conflict (id) do update set
  quote_case_id = excluded.quote_case_id,
  reservation_id = excluded.reservation_id,
  agency_account_id = excluded.agency_account_id,
  match_confidence = excluded.match_confidence,
  requires_manual_review = excluded.requires_manual_review;

insert into email_messages (
  id,
  email_thread_id,
  gmail_message_id,
  from_email,
  to_emails,
  subject,
  body_text,
  received_at,
  provider_payload
)
values (
  '00000000-0000-4000-8000-000000009902',
  '00000000-0000-4000-8000-000000009901',
  'gmail-demo-message-001',
  'agency-user@worldtravellers.example',
  array['sales@junghotravel.local']::citext[],
  'Booking request for JHT-2026-DEMO-001',
  'Demo Gmail message linked to the accepted quote and reservation.',
  '2026-06-27 08:30:00+00',
  '{"demo":true}'::jsonb
)
on conflict (id) do update set
  from_email = excluded.from_email,
  to_emails = excluded.to_emails,
  subject = excluded.subject,
  body_text = excluded.body_text,
  received_at = excluded.received_at,
  provider_payload = excluded.provider_payload;

insert into migration_batches (id, source_name, source_kind, target_table, status, uploaded_by)
values (
  '00000000-0000-4000-8000-000000009951',
  'demo-domestic-suppliers.csv',
  'notion_csv',
  'domestic_suppliers',
  'validated',
  '00000000-0000-4000-8000-000000002001'
)
on conflict (id) do update set
  source_name = excluded.source_name,
  target_table = excluded.target_table,
  status = excluded.status,
  uploaded_by = excluded.uploaded_by;

insert into staging_rows (
  id,
  migration_batch_id,
  row_no,
  raw_payload,
  mapped_payload,
  validation_status
)
values (
  '00000000-0000-4000-8000-000000009952',
  '00000000-0000-4000-8000-000000009951',
  1,
  '{"company_id":"00000000-0000-4000-8000-000000001001","name_ko":"Demo Supplier","category":"hotel"}'::jsonb,
  '{"company_id":"00000000-0000-4000-8000-000000001001","name_ko":"Demo Supplier","category":"hotel"}'::jsonb,
  'valid'
)
on conflict (id) do update set
  raw_payload = excluded.raw_payload,
  mapped_payload = excluded.mapped_payload,
  validation_status = excluded.validation_status;

insert into audit_logs (
  id,
  actor_profile_id,
  action,
  entity_table,
  entity_id,
  risk_level,
  after_data,
  created_at
)
values (
  '00000000-0000-4000-8000-000000009961',
  '00000000-0000-4000-8000-000000002001',
  'demo.seed_loaded',
  'companies',
  '00000000-0000-4000-8000-000000001001',
  'normal',
  '{"demo":true,"scope":"v1"}'::jsonb,
  now()
)
on conflict (id) do update set
  after_data = excluded.after_data,
  created_at = now();

insert into api_logs (
  id,
  source,
  endpoint,
  method,
  status_code,
  request_payload,
  response_payload,
  idempotency_key
)
values (
  '00000000-0000-4000-8000-000000009971',
  'demo_seed',
  '/api/automation/failed-jobs',
  'GET',
  200,
  '{"demo":true}'::jsonb,
  '{"failedJobCount":2}'::jsonb,
  'demo-seed-api-log'
)
on conflict (id) do update set
  source = excluded.source,
  endpoint = excluded.endpoint,
  method = excluded.method,
  status_code = excluded.status_code,
  request_payload = excluded.request_payload,
  response_payload = excluded.response_payload,
  idempotency_key = excluded.idempotency_key;

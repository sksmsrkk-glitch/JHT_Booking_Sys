insert into companies (code, name_ko, name_en)
values
  ('JHT', '정호여행사', 'Jung Ho Travel Service'),
  ('AMT', '올마이투어', 'AllMyTour')
on conflict (code) do update set
  name_ko = excluded.name_ko,
  name_en = excluded.name_en;

insert into agency_accounts (company_id, name, country_code, email_domain, billing_currency)
select id, 'World Travellers DMC', 'MY', 'worldtravellers-dmc.com', 'MYR'
from companies
where code = 'JHT'
on conflict do nothing;

insert into domestic_suppliers (company_id, category, name_ko, name_en, region_level1, region_level2, status)
select id, 'hotel', '롯데호텔 부산', 'Lotte Hotel Busan', '부산', '부산진구', 'active'
from companies
where code = 'JHT'
on conflict do nothing;

insert into domestic_suppliers (company_id, category, name_ko, name_en, region_level1, status)
select id, 'restaurant', '대게만찬', 'Daegemanchan', '부산', 'active'
from companies
where code = 'JHT'
on conflict do nothing;

insert into supplier_products (domestic_supplier_id, product_type, name_ko, name_en, search_name, room_type, breakfast_included)
select id, 'room', '디럭스 트윈', 'Deluxe Twin', 'Lotte Hotel Busan Deluxe Twin', 'TWIN', true
from domestic_suppliers
where name_en = 'Lotte Hotel Busan'
on conflict do nothing;

insert into supplier_prices (supplier_product_id, pricing_unit, currency, cost_amount, season_label, valid_from, valid_to)
select id, 'per_room', 'KRW', 209000, 'weekday sample', '2026-01-01', '2026-12-31'
from supplier_products
where search_name = 'Lotte Hotel Busan Deluxe Twin'
on conflict do nothing;

alter table agency_inquiries
  add column if not exists tour_code text,
  add column if not exists arrival_date date,
  add column if not exists departure_date date,
  add column if not exists period_text text,
  add column if not exists nights_count integer check (nights_count is null or nights_count > 0),
  add column if not exists flight_details jsonb not null default '[]'::jsonb;

create index if not exists agency_inquiries_tour_code_idx
  on agency_inquiries(tour_code);

create index if not exists agency_inquiries_arrival_departure_idx
  on agency_inquiries(arrival_date, departure_date);

alter table quote_items
  add column if not exists service_section text not null default 'land',
  add column if not exists calculation_mode text not null default 'auto_formula',
  add column if not exists excel_cell_ref text,
  add column if not exists excel_formula text,
  add column if not exists manual_override boolean not null default false,
  add column if not exists supplier_cost_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists public_breakdown jsonb not null default '{}'::jsonb;

create index if not exists quote_items_version_section_idx
  on quote_items(quote_version_id, service_section, item_category);

create index if not exists agency_inquiries_related_quote_case_created_idx
  on agency_inquiries(related_quote_case_id, created_at);

alter table agency_signup_applications
  add column if not exists requested_billing_currency text;

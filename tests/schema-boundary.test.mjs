import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../supabase/migrations/202605100001_initial_schema.sql", import.meta.url), "utf8");

test("agency and domestic supplier tables are separate business boundaries", () => {
  assert.match(schema, /create table agency_accounts/);
  assert.match(schema, /create table agency_users/);
  assert.match(schema, /create table domestic_suppliers/);
  assert.match(schema, /create table supplier_products/);
  assert.doesNotMatch(schema, /create table partners\b/);
});

test("agency booking requests are represented without granting reservation write access", () => {
  assert.match(schema, /agency_inquiry_type as enum \('[^']*new_inquiry[^;]+booking_request/);
  assert.match(schema, /create policy "reservations internal all"/);
  assert.match(schema, /create policy "reservations agency select"/);
  assert.doesNotMatch(schema, /create policy "reservations agency insert"/);
});

test("overseas agency cannot read supplier costs or quote item internals", () => {
  assert.match(schema, /create policy "supplier prices internal only"/);
  assert.match(schema, /create policy "quote items internal only"/);
  assert.doesNotMatch(schema, /supplier prices agency select/);
  assert.doesNotMatch(schema, /quote items agency select/);
});

test("supplier message send is protected by approvals and idempotency", () => {
  assert.match(schema, /idempotency_key text not null unique/);
  assert.match(schema, /status not in \('approved', 'queued', 'sending', 'sent'\) or \(approved_by is not null/);
  assert.match(schema, /message_type <> 'cancellation_request' or status not in \('queued', 'sending', 'sent'\) or second_approved_by is not null/);
});

test("route segments can be shared to agencies only through sent quote versions", () => {
  assert.match(schema, /create policy "route segments agency select"/);
  assert.match(schema, /qv.status in \('sent', 'accepted', 'superseded'\)/);
});

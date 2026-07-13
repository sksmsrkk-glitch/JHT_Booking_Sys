import { readFileSync } from "node:fs";

const seedSql = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");

const requiredTables = [
  "auth.users",
  "companies",
  "profiles",
  "user_roles",
  "agency_accounts",
  "agency_users",
  "agency_contacts",
  "domestic_suppliers",
  "supplier_contacts",
  "supplier_products",
  "supplier_prices",
  "agency_inquiries",
  "quote_cases",
  "quote_versions",
  "quote_itinerary_days",
  "route_segments",
  "quote_items",
  "quote_exports",
  "reservations",
  "reservation_status_history",
  "rooming_lists",
  "passengers",
  "room_assignments",
  "operation_tasks",
  "supplier_message_templates",
  "supplier_message_outbox",
  "supplier_message_events",
  "invoices",
  "payments",
  "expenses",
  "extra_revenues",
  "shopping_commissions",
  "settlements",
  "email_threads",
  "email_messages",
  "migration_batches",
  "staging_rows",
  "audit_logs",
  "api_logs"
];

const requiredSnippets = [
  "Local v1 demo seed",
  "demo-admin@junghotravel.local",
  "JhtDemo!2026",
  "agency-user@worldtravellers.example",
  "AgencyDemo!2026",
  "MY-WORLDTRAVE-20260627-A1B2C3",
  "MY-WORLDTRAVE-20260627-A1B2C3-INV-V01",
  "Demo provider timeout for failed jobs view",
  "Demo storage timeout for failed jobs view",
  "demo.seed_loaded"
];

const failures = [];

for (const tableName of requiredTables) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`insert\\s+into\\s+${escaped}\\b`, "i").test(seedSql)) {
    failures.push(`Missing insert into ${tableName}`);
  }
}

for (const snippet of requiredSnippets) {
  if (!seedSql.includes(snippet)) {
    failures.push(`Missing required seed snippet: ${snippet}`);
  }
}

const stableUuidCount = (seedSql.match(/00000000-0000-4000-8000-[0-9]{12}/g) ?? []).length;
if (stableUuidCount < 80) {
  failures.push(`Expected stable demo UUID usage, found only ${stableUuidCount}`);
}

if (hasGarbledCharacters(seedSql)) {
  failures.push("Seed contains replacement/garbled characters");
}

if (/production|prod\.|real customer/i.test(seedSql)) {
  failures.push("Seed appears to reference production or real-customer data");
}

if (!/on conflict/i.test(seedSql)) {
  failures.push("Seed should be repeatable and use ON CONFLICT guards");
}

if (failures.length > 0) {
  console.error("Seed verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Seed verification passed for ${requiredTables.length} tables and ${stableUuidCount} stable UUID references.`);

function hasGarbledCharacters(value) {
  return [...value].some((character) => character === "�" || character.charCodeAt(0) === 0xfffd) || /\?{2,}/.test(value);
}

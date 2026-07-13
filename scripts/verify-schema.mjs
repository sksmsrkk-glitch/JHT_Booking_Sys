import { readdirSync, readFileSync } from "node:fs";
import { READINESS_SMOKE_TABLES } from "../src/lib/domain/readiness.mjs";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const migrationFiles = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();
const migrationSql = migrationFiles
  .map((fileName) => readFileSync(new URL(fileName, migrationsDir), "utf8"))
  .join("\n");
const seedSql = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");

const createdTables = new Set(
  [...migrationSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi)].map(
    (match) => normalizeTableName(match[1])
  )
);

const seedTables = new Set(
  [...seedSql.matchAll(/insert\s+into\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi)].map((match) =>
    normalizeTableName(match[1])
  )
);

const rlsEnabledTables = new Set(
  [...migrationSql.matchAll(/alter\s+table\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\s+enable\s+row\s+level\s+security/gi)].map(
    (match) => normalizeTableName(match[1])
  )
);

const policyTables = new Map();
for (const match of migrationSql.matchAll(
  /create\s+policy\s+"([^"]+)"\s+on\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi
)) {
  const policyName = match[1];
  const tableName = normalizeTableName(match[2]);
  policyTables.set(tableName, [...(policyTables.get(tableName) ?? []), policyName]);
}

const allowedExternalTables = new Set(["auth.users"]);
const agencyForbiddenTables = [
  "domestic_suppliers",
  "supplier_contacts",
  "supplier_products",
  "supplier_prices",
  "supplier_media",
  "quote_items",
  "quote_exports",
  "operation_tasks",
  "operation_task_dependencies",
  "operation_reminder_rules",
  "operation_reminder_logs",
  "supplier_message_templates",
  "supplier_message_outbox",
  "supplier_message_events",
  "expenses",
  "extra_revenues",
  "shopping_commissions",
  "settlements",
  "email_threads",
  "email_messages",
  "email_attachments",
  "migration_batches",
  "staging_rows",
  "migration_errors",
  "audit_logs",
  "api_logs",
  "gmail_match_candidates",
  "account_recovery_requests"
];
const failures = [];

for (const tableName of READINESS_SMOKE_TABLES.map((check) => check.table)) {
  if (!createdTables.has(tableName)) {
    failures.push(`Readiness smoke table is not created by migrations: ${tableName}`);
  }
}

for (const tableName of seedTables) {
  if (!createdTables.has(tableName) && !allowedExternalTables.has(tableName)) {
    failures.push(`Seed inserts into table not created by migrations: ${tableName}`);
  }
}

for (const tableName of createdTables) {
  if (!rlsEnabledTables.has(tableName)) {
    failures.push(`Created table is missing row level security enablement: ${tableName}`);
  }
  if (!policyTables.has(tableName)) {
    failures.push(`Created table is missing at least one RLS policy: ${tableName}`);
  }
}

for (const tableName of ["api_logs", "gmail_match_candidates", "quote_exports", "supplier_message_outbox"]) {
  if (!createdTables.has(tableName)) {
    failures.push(`Expected v1 support table is missing from migrations: ${tableName}`);
  }
}

for (const tableName of agencyForbiddenTables) {
  const policies = policyTables.get(tableName) ?? [];
  if (policies.some((policyName) => /\bagency\b/i.test(policyName))) {
    failures.push(`Agency policy must not exist on internal-only table: ${tableName}`);
  }
}

for (const tableName of [
  "agency_accounts",
  "agency_users",
  "agency_contacts",
  "agency_inquiries",
  "quote_cases",
  "quote_versions",
  "quote_itinerary_days",
  "route_segments",
  "reservations",
  "reservation_status_history",
  "rooming_lists",
  "passengers",
  "room_assignments",
  "invoices",
  "payments"
]) {
  const policies = policyTables.get(tableName) ?? [];
  if (!policies.some((policyName) => /\bagency\b/i.test(policyName))) {
    failures.push(`Expected agency-scoped policy is missing on customer-visible table: ${tableName}`);
  }
}

for (const tableName of ["partners", "gmail_messages"]) {
  if (createdTables.has(tableName)) {
    failures.push(`Unexpected legacy/ambiguous table exists in migrations: ${tableName}`);
  }
}

if (migrationFiles.length === 0) {
  failures.push("No migration files found");
}

if (failures.length > 0) {
  console.error("Schema verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Schema verification passed for ${createdTables.size} created tables, ${policyTables.size} RLS policy tables, ${seedTables.size} seed tables, and ${READINESS_SMOKE_TABLES.length} readiness smoke tables.`
);

function normalizeTableName(tableName) {
  return String(tableName).toLowerCase();
}

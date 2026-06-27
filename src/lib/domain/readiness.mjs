export const READINESS_ENV_CHECKS = [
  {
    key: "supabase_url",
    label: "Supabase URL",
    envName: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    group: "Supabase"
  },
  {
    key: "supabase_anon_key",
    label: "Supabase anon key",
    envName: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    group: "Supabase"
  },
  {
    key: "supabase_service_role_key",
    label: "Supabase service role key",
    envName: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    group: "Supabase"
  },
  {
    key: "automation_secret",
    label: "Automation shared secret",
    envName: "AUTOMATION_SECRET",
    required: true,
    group: "Automation"
  },
  {
    key: "gmail_webhook_secret",
    label: "Gmail webhook secret",
    envName: "GMAIL_WEBHOOK_SECRET",
    required: true,
    group: "Automation"
  },
  {
    key: "supplier_message_webhook_secret",
    label: "Supplier message provider webhook secret",
    envName: "SUPPLIER_MESSAGE_WEBHOOK_SECRET",
    required: true,
    group: "Supplier Messaging"
  },
  {
    key: "supplier_message_delivery_mode",
    label: "Supplier message delivery mode",
    envName: "SUPPLIER_MESSAGE_DELIVERY_MODE",
    required: false,
    group: "Supplier Messaging"
  },
  {
    key: "email_provider_name",
    label: "Email provider name",
    envName: "EMAIL_PROVIDER_NAME",
    required: false,
    group: "Supplier Messaging"
  },
  {
    key: "email_provider_api_key",
    label: "Email provider API key",
    envName: "EMAIL_PROVIDER_API_KEY",
    required: false,
    group: "Supplier Messaging"
  },
  {
    key: "initial_admin_bootstrap_secret",
    label: "Initial admin bootstrap secret",
    envName: "INITIAL_ADMIN_BOOTSTRAP_SECRET",
    required: false,
    group: "Bootstrap"
  },
  {
    key: "export_storage_bucket",
    label: "Quote export storage bucket",
    envName: "EXPORT_STORAGE_BUCKET",
    required: false,
    group: "Storage"
  },
  {
    key: "google_maps_api_key",
    label: "Google Maps API key",
    envName: "GOOGLE_MAPS_API_KEY",
    required: false,
    group: "Integrations"
  },
  {
    key: "kakao_biz_provider",
    label: "Kakao business provider",
    envName: "KAKAO_BIZ_PROVIDER",
    required: false,
    group: "Integrations"
  },
  {
    key: "kakao_biz_api_key",
    label: "Kakao business API key",
    envName: "KAKAO_BIZ_API_KEY",
    required: false,
    group: "Integrations"
  },
  {
    key: "system_default_currency",
    label: "System default currency",
    envName: "SYSTEM_DEFAULT_CURRENCY",
    required: false,
    group: "Finance"
  }
];

export const READINESS_WORKFLOW_CHECKS = [
  {
    key: "auth_cookie_session",
    label: "Browser login stores server-readable access token cookie",
    route: "/auth/login",
    group: "Auth"
  },
  {
    key: "initial_admin_bootstrap",
    label: "First internal admin can be bootstrapped before any internal role exists",
    route: "/admin/bootstrap",
    group: "Bootstrap"
  },
  {
    key: "internal_user_role_management",
    label: "Admin users can manage internal roles and validate default company selection",
    route: "/admin/users",
    group: "Auth"
  },
  {
    key: "company_master_management",
    label: "Admin users can create operating company master records after bootstrap",
    route: "/admin/companies",
    group: "Master Data"
  },
  {
    key: "agency_master_management",
    label: "Sales/Admin users can manage Overseas Agency accounts, contacts, and portal users",
    route: "/admin/agencies",
    group: "Master Data"
  },
  {
    key: "domestic_supplier_product_pricing",
    label: "Operations users can manage Domestic Supplier contacts, products, and prices",
    route: "/admin/domestic-suppliers",
    group: "Master Data"
  },
  {
    key: "quote_item_cost_selector",
    label: "Quote item snapshots can be prefilled from active Domestic Supplier product/price rows",
    route: "/admin/quote-cases",
    group: "Sales"
  },
  {
    key: "quote_version_lifecycle",
    label: "Quote versions can be drafted, sent, revised, accepted, and converted to reservations",
    route: "/admin/quote-cases",
    group: "Sales"
  },
  {
    key: "quote_xlsx_export_worker",
    label: "Quote XLSX exports can be queued, processed by automation, and stored in Supabase Storage",
    route: "/api/automation/quote-exports/run",
    group: "Automation"
  },
  {
    key: "quote_xlsx_export_retry",
    label: "Failed Quote XLSX export rows can be retried from internal admin without creating agency-visible data",
    route: "/admin/automation/failed-jobs",
    group: "Automation"
  },
  {
    key: "agency_quote_boundary",
    label: "Agency quote pages expose only sent/accepted customer-safe quote data",
    route: "/agency/quote-cases",
    group: "Boundary"
  },
  {
    key: "reservation_rooming_and_rooms",
    label: "Reservations support status history, rooming list uploads, passengers, and room assignments",
    route: "/admin/reservations",
    group: "Operations"
  },
  {
    key: "operation_task_board",
    label: "Operation task board supports status, due date, blocked reason, supplier linking, and audited terminal-safe reminders",
    route: "/admin/operations/tasks",
    group: "Operations"
  },
  {
    key: "supplier_message_draft_selector",
    label: "Supplier message drafts use reservation and Domestic Supplier selectors before approval/send",
    route: "/admin/supplier-messages",
    group: "Supplier Messaging"
  },
  {
    key: "agency_supplier_boundary",
    label: "Agency Portal does not expose supplier cost, quote item, or settlement internals",
    route: "/agency",
    group: "Boundary"
  },
  {
    key: "supplier_messages_callbacks",
    label: "Supplier message outbox can record provider callback events",
    route: "/api/supplier-messages/provider-callback",
    group: "Automation"
  },
  {
    key: "supplier_message_delivery_worker",
    label: "Supplier message outbox can process queued messages through the delivery worker",
    route: "/api/automation/supplier-messages/run",
    group: "Automation"
  },
  {
    key: "supplier_message_requeue",
    label: "Failed supplier message deliveries can be requeued with approval checks, provider event evidence, and audit logs",
    route: "/admin/automation/failed-jobs",
    group: "Supplier Messaging"
  },
  {
    key: "invoice_print_view",
    label: "Invoices can be issued before settlement close and detail pages include printable views",
    route: "/admin/finance/invoices",
    group: "Finance"
  },
  {
    key: "finance_adjustment_selectors",
    label: "Finance adjustment and settlement forms use reservation selectors for routine operation",
    route: "/admin/finance/settlements",
    group: "Finance"
  },
  {
    key: "gmail_manual_review",
    label: "Low-confidence Gmail matching can be manually linked or unlinked with audit evidence",
    route: "/admin/automation/gmail-review",
    group: "Automation"
  },
  {
    key: "notion_csv_staging",
    label: "Notion CSV migration batches can be staged, validated, and approved before import",
    route: "/admin/migrations/notion-csv",
    group: "Migration"
  },
  {
    key: "audit_visibility",
    label: "High-risk actions are visible in the audit log",
    route: "/admin/audit",
    group: "Audit"
  },
  {
    key: "api_log_visibility",
    label: "Webhook and automation call traces are visible in API logs",
    route: "/admin/audit/api-logs",
    group: "Audit"
  }
];

export const READINESS_LAUNCH_CHECKS = [
  {
    key: "verify_v1",
    label: "Run `npm run verify:v1` after final env changes",
    group: "Verification",
    evidence: "Seed guard, tests, typecheck, production build, and runtime smoke pass together"
  },
  {
    key: "apply_migrations",
    label: "Apply Supabase migrations to the target project",
    group: "Supabase",
    evidence: "All migration files under supabase/migrations have been applied in order"
  },
  {
    key: "load_seed_local_only",
    label: "Load demo seed only in local or disposable staging",
    group: "Supabase",
    evidence: "Demo credentials and rows are removed or replaced before real production data"
  },
  {
    key: "create_storage_bucket",
    label: "Create the quote export Storage bucket",
    group: "Storage",
    evidence: "`EXPORT_STORAGE_BUCKET` exists and XLSX upload/read permissions are configured"
  },
  {
    key: "bootstrap_admin",
    label: "Create the first internal admin and rotate bootstrap secret",
    group: "Auth",
    evidence: "Admin can sign in, manage users, and `INITIAL_ADMIN_BOOTSTRAP_SECRET` is removed or rotated"
  },
  {
    key: "configure_domain",
    label: "Connect production domain and auth redirect URLs",
    group: "Domain",
    evidence: "Domain, callback URLs, cookies, and HTTPS redirects are configured"
  },
  {
    key: "configure_webhooks",
    label: "Register Gmail and supplier provider webhook URLs",
    group: "Automation",
    evidence: "Webhook providers use current secrets and target production API endpoints"
  },
  {
    key: "schedule_workers",
    label: "Schedule automation workers",
    group: "Automation",
    evidence: "Reminder, quote export, and supplier message worker endpoints run with `x-automation-secret`"
  },
  {
    key: "confirm_agency_boundary",
    label: "Confirm Agency Portal data boundary with a real agency user",
    group: "Boundary",
    evidence: "Agency user cannot see supplier costs, quote item internals, settlements, expenses, or passport numbers"
  }
];

export const READINESS_SMOKE_TABLES = [
  { key: "companies", label: "Operating companies", table: "companies", group: "Master Data" },
  { key: "profiles", label: "Internal user profiles", table: "profiles", group: "Auth" },
  { key: "user_roles", label: "Internal user roles", table: "user_roles", group: "Auth" },
  { key: "agency_accounts", label: "Overseas Agency master", table: "agency_accounts", group: "Master Data" },
  { key: "agency_contacts", label: "Overseas Agency contacts", table: "agency_contacts", group: "Master Data" },
  { key: "agency_users", label: "Agency Portal users", table: "agency_users", group: "Auth" },
  { key: "domestic_suppliers", label: "Domestic Supplier master", table: "domestic_suppliers", group: "Master Data" },
  { key: "supplier_contacts", label: "Domestic Supplier contacts", table: "supplier_contacts", group: "Master Data" },
  { key: "supplier_products", label: "Domestic Supplier products", table: "supplier_products", group: "Master Data" },
  { key: "supplier_prices", label: "Domestic Supplier prices", table: "supplier_prices", group: "Master Data" },
  { key: "quote_cases", label: "Quote cases", table: "quote_cases", group: "Sales" },
  { key: "quote_versions", label: "Quote versions", table: "quote_versions", group: "Sales" },
  { key: "quote_items", label: "Quote item snapshots", table: "quote_items", group: "Sales" },
  { key: "quote_itinerary_days", label: "Quote itinerary days", table: "quote_itinerary_days", group: "Sales" },
  { key: "route_segments", label: "Quote route segments", table: "route_segments", group: "Sales" },
  { key: "quote_exports", label: "Quote XLSX export queue", table: "quote_exports", group: "Sales" },
  { key: "reservations", label: "Reservations", table: "reservations", group: "Operations" },
  { key: "reservation_status_history", label: "Reservation status history", table: "reservation_status_history", group: "Operations" },
  { key: "operation_tasks", label: "Operation tasks", table: "operation_tasks", group: "Operations" },
  { key: "rooming_lists", label: "Rooming lists", table: "rooming_lists", group: "Operations" },
  { key: "passengers", label: "Passengers", table: "passengers", group: "Operations" },
  { key: "room_assignments", label: "Room assignments", table: "room_assignments", group: "Operations" },
  { key: "supplier_message_outbox", label: "Supplier message outbox", table: "supplier_message_outbox", group: "Supplier Messaging" },
  { key: "supplier_message_events", label: "Supplier message provider events", table: "supplier_message_events", group: "Supplier Messaging" },
  { key: "supplier_message_templates", label: "Supplier message templates", table: "supplier_message_templates", group: "Supplier Messaging" },
  { key: "invoices", label: "Invoices", table: "invoices", group: "Finance" },
  { key: "payments", label: "Payments", table: "payments", group: "Finance" },
  { key: "expenses", label: "Expenses", table: "expenses", group: "Finance" },
  { key: "extra_revenues", label: "Extra revenues", table: "extra_revenues", group: "Finance" },
  { key: "shopping_commissions", label: "Shopping commissions", table: "shopping_commissions", group: "Finance" },
  { key: "settlements", label: "Settlements", table: "settlements", group: "Finance" },
  { key: "email_threads", label: "Email threads", table: "email_threads", group: "Automation" },
  { key: "email_messages", label: "Email messages", table: "email_messages", group: "Automation" },
  { key: "gmail_match_candidates", label: "Gmail match candidates", table: "gmail_match_candidates", group: "Automation" },
  { key: "migration_batches", label: "Migration batches", table: "migration_batches", group: "Migration" },
  { key: "staging_rows", label: "Migration staging rows", table: "staging_rows", group: "Migration" },
  { key: "migration_errors", label: "Migration validation errors", table: "migration_errors", group: "Migration" },
  { key: "audit_logs", label: "Audit logs", table: "audit_logs", group: "Audit" }
];

export const READINESS_STORAGE_CHECKS = [
  {
    key: "quote_exports_bucket",
    label: "Quote export XLSX bucket",
    bucketEnvName: "EXPORT_STORAGE_BUCKET",
    defaultBucket: "exports",
    group: "Storage"
  }
];

export function buildReadinessReport(env = process.env) {
  const envChecks = READINESS_ENV_CHECKS.map((check) => {
    const configured = isConfigured(env[check.envName]);
    return {
      ...check,
      configured,
      status: configured ? "ready" : check.required ? "missing" : "optional"
    };
  });

  const requiredMissing = envChecks.filter((check) => check.required && !check.configured);
  const optionalMissing = envChecks.filter((check) => !check.required && !check.configured);
  const status = requiredMissing.length === 0 ? "ready" : "blocked";

  return {
    status,
    generatedAt: new Date().toISOString(),
    summary: {
      requiredTotal: envChecks.filter((check) => check.required).length,
      requiredConfigured: envChecks.filter((check) => check.required && check.configured).length,
      requiredMissing: requiredMissing.length,
      optionalMissing: optionalMissing.length
    },
    envChecks,
    smokeChecks: [],
    storageChecks: [],
    workflowChecks: READINESS_WORKFLOW_CHECKS,
    workflowSummary: summarizeReadinessWorkflowChecks(READINESS_WORKFLOW_CHECKS),
    launchChecks: READINESS_LAUNCH_CHECKS,
    launchSummary: summarizeReadinessLaunchChecks(READINESS_LAUNCH_CHECKS)
  };
}

export function summarizeReadinessSmokeChecks(results = []) {
  const failed = results.filter((result) => result.status !== "ready");
  return {
    total: results.length,
    ready: results.length - failed.length,
    failed: failed.length,
    status: failed.length === 0 ? "ready" : "blocked"
  };
}

export function summarizeReadinessWorkflowChecks(results = []) {
  const byGroup = results.reduce((groups, result) => {
    groups[result.group] = (groups[result.group] ?? 0) + 1;
    return groups;
  }, {});

  return {
    total: results.length,
    groups: byGroup
  };
}

export function summarizeReadinessLaunchChecks(results = []) {
  const byGroup = results.reduce((groups, result) => {
    groups[result.group] = (groups[result.group] ?? 0) + 1;
    return groups;
  }, {});

  return {
    total: results.length,
    groups: byGroup
  };
}

export function summarizeReadinessStorageChecks(results = []) {
  const failed = results.filter((result) => result.status !== "ready");
  return {
    total: results.length,
    ready: results.length - failed.length,
    failed: failed.length,
    status: failed.length === 0 ? "ready" : "blocked"
  };
}

function isConfigured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

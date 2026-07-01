import type { Route } from "next";

export type V1RouteCard = {
  href: Route;
  title: string;
  description: string;
  status: "live" | "ready" | "next";
  owner: string;
};

export const adminRoutes: V1RouteCard[] = [
  {
    href: "/admin/companies" as Route,
    title: "Companies",
    description: "Operating company records used across agencies, suppliers, quotes, and internal users.",
    status: "live",
    owner: "Admin"
  },
  {
    href: "/admin/domestic-suppliers" as Route,
    title: "Domestic Suppliers",
    description: "Korea-side supplier master data, contacts, products, and prices.",
    status: "live",
    owner: "Operations"
  },
  {
    href: "/admin/agencies" as Route,
    title: "Overseas Agencies",
    description: "Foreign agency customer accounts, contacts, and portal users.",
    status: "live",
    owner: "Sales"
  },
  {
    href: "/admin/costing/search" as Route,
    title: "Cost Search",
    description: "Search active supplier products and prices before quote snapshotting.",
    status: "live",
    owner: "Sales Ops"
  },
  {
    href: "/admin/exchange-rates" as Route,
    title: "Exchange Rates",
    description: "Central KRW exchange-rate master used by quotes, cost snapshots, invoices, and settlements.",
    status: "live",
    owner: "Finance"
  },
  {
    href: "/admin/quote-cases" as Route,
    title: "Quote Cases",
    description: "Build quote cases, versions, itineraries, route segments, and exports.",
    status: "live",
    owner: "Sales"
  },
  {
    href: "/admin/reservations" as Route,
    title: "Reservations",
    description: "Track accepted quotes through reservation status, rooming lists, and history.",
    status: "live",
    owner: "Operations"
  },
  {
    href: "/admin/confirmations" as Route,
    title: "Final Confirmations",
    description: "Create partner-ready confirmation documents from accepted quotes and final operation values.",
    status: "live",
    owner: "Operations"
  },
  {
    href: "/admin/guide-expenses" as Route,
    title: "Guide Expenses",
    description: "Guide-entered actual tour costs connected to invoices, expenses, and settlement profit analysis.",
    status: "live",
    owner: "Finance"
  },
  {
    href: "/admin/operations/tasks" as Route,
    title: "Operation Tasks",
    description: "Team task board with reminder, dependency, blocked, and overdue states.",
    status: "live",
    owner: "Operations"
  },
  {
    href: "/admin/supplier-messages" as Route,
    title: "Supplier Messages",
    description: "Draft-first email/Kakao outbox with approval and idempotent send controls.",
    status: "live",
    owner: "Booking Teams"
  },
  {
    href: "/admin/finance/invoices" as Route,
    title: "Finance",
    description: "Invoices, payments, expenses, shopping commissions, and settlements.",
    status: "live",
    owner: "Finance"
  },
  {
    href: "/admin/automation/gmail-review" as Route,
    title: "Gmail Review",
    description: "Manual review queue for low-confidence Gmail thread matching.",
    status: "ready",
    owner: "Sales Ops"
  },
  {
    href: "/admin/automation/failed-jobs" as Route,
    title: "Failed Jobs",
    description: "Recovery queue for failed supplier delivery and Quote XLSX export jobs.",
    status: "ready",
    owner: "Operations"
  },
  {
    href: "/admin/migrations/notion-csv" as Route,
    title: "Notion CSV Migration",
    description: "Staged migration workflow with validation and approval before import.",
    status: "ready",
    owner: "Admin"
  },
  {
    href: "/admin/audit" as Route,
    title: "Audit Log",
    description: "High-risk action trail for approvals, status changes, and automation events.",
    status: "live",
    owner: "Admin"
  },
  {
    href: "/admin/audit/api-logs" as Route,
    title: "API Logs",
    description: "Operational API, webhook, and automation call trail for support and debugging.",
    status: "ready",
    owner: "Admin"
  },
  {
    href: "/admin/readiness" as Route,
    title: "V1 Readiness",
    description: "Environment, webhook secret, and final workflow gate checklist before real DB/domain setup.",
    status: "live",
    owner: "Admin"
  },
  {
    href: "/admin/users" as Route,
    title: "Internal Users",
    description: "Register internal profiles and manage admin, finance, sales, and operations roles.",
    status: "live",
    owner: "Admin"
  }
];

export const agencyRoutes: V1RouteCard[] = [
  {
    href: "/agency/inquiries" as Route,
    title: "Inquiries",
    description: "Create and track new inquiries, revision requests, and booking requests.",
    status: "live",
    owner: "Agency User"
  },
  {
    href: "/agency/inquiries/new" as Route,
    title: "New Inquiry",
    description: "Focused inquiry submission page for agency users.",
    status: "live",
    owner: "Agency User"
  },
  {
    href: "/agency/quote-cases" as Route,
    title: "Quotes",
    description: "Review public quote versions without cost, margin, or supplier internals.",
    status: "live",
    owner: "Agency User"
  },
  {
    href: "/agency/reservations" as Route,
    title: "Reservations",
    description: "View agency-owned reservations, status history, and rooming list revisions.",
    status: "live",
    owner: "Agency User"
  },
  {
    href: "/agency/invoices" as Route,
    title: "Invoices",
    description: "Review issued invoices and safe payment summaries for own reservations.",
    status: "live",
    owner: "Agency User"
  }
];

export const v1Milestones = [
  "Internal supplier master data browsing",
  "Overseas agency account and inquiry management",
  "Cost search and quote snapshot creation",
  "Quote version public/internal separation",
  "Reservation lifecycle with status history",
  "Operation task reminders and supplier message approval",
  "Invoice, payment, expense, and settlement workspace",
  "Gmail/manual review and Notion CSV staging"
];

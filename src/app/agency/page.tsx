import type { Route } from "next";
import Link from "next/link";

const partnerTasks = [
  {
    href: "/agency/inquiries/new" as Route,
    title: "Create New Inquiry",
    description: "Submit tour title, pax, nights, travel period, flights, routing, meals, and special requests.",
    meta: "Start here"
  },
  {
    href: "/agency/quote-cases" as Route,
    title: "Review Quotes",
    description: "Open customer-safe quote versions, itinerary descriptions, public totals, and request revisions.",
    meta: "Cost details hidden"
  },
  {
    href: "/agency/workflows" as Route,
    title: "Communication",
    description: "Continue all quote changes, booking questions, cancellation requests, and JHT replies by workflow code.",
    meta: "Code-based history"
  },
  {
    href: "/agency/reservations" as Route,
    title: "Reservations",
    description: "Track confirmed groups, rooming list revisions, reservation status, and partner-visible updates.",
    meta: "After confirmation"
  },
  {
    href: "/agency/invoices" as Route,
    title: "Invoices",
    description: "Check issued invoice versions, payment summaries, deposit status, and receivable follow-up.",
    meta: "Finance safe view"
  }
];

const processSteps = ["Inquiry", "Quote", "Revision", "Confirmation", "Reservation", "Invoice"];

export default function AgencyPage() {
  return (
    <div className="partner-portal-shell">
      <section className="partner-portal-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Partner Work Dashboard</h1>
          <p>
            A partner-only workspace for inquiries, quotes, revision requests, reservations, rooming lists, and
            invoices under one tour workflow code.
          </p>
        </div>
        <div className="partner-access-panel">
          <span>Partner Account</span>
          <strong>Approval Required</strong>
          <p>
            New agencies submit an application first. JHT approval activates the mother account.
          </p>
          <div className="partner-access-actions">
            <Link className="button-primary" href={"/agency/login" as Route}>
              Partner Log In
            </Link>
            <Link className="button-secondary" href={"/agency/signup" as Route}>
              Apply
            </Link>
          </div>
        </div>
      </section>

      <section className="partner-status-strip" aria-label="Partner workflow">
        {processSteps.map((step, index) => (
          <div className="partner-status-item" key={step}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{step}</strong>
          </div>
        ))}
      </section>

      <section className="partner-task-grid" aria-label="Partner task menu">
        {partnerTasks.map((task) => (
          <Link className="partner-task-card" href={task.href} key={task.href}>
            <div>
              <span>{task.meta}</span>
              <h2>{task.title}</h2>
            </div>
            <p>{task.description}</p>
          </Link>
        ))}
      </section>

      <section className="notice">
        <h2>Customer-safe boundary</h2>
        <p>
          This portal only exposes partner-safe quotes, reservations, communication, and invoice information. Domestic
          supplier costs, margins, internal tasks, and settlement ledgers remain internal-only.
        </p>
      </section>
    </div>
  );
}

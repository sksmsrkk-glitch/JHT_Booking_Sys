import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import { adminRoutes, agencyRoutes, v1Milestones } from "@/features/v1/site-map";

export default function HomePage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Version 1 Build</p>
          <h1>Jungho Travel Operations Platform</h1>
          <p>
            Inbound travel operating system for quotation, reservation, supplier operations,
            rooming lists, reminders, invoices, payment tracking, and settlement.
          </p>
        </div>
      </div>
      <section className="grid">
        <article className="panel">
          <span className="badge">Customer Side</span>
          <h2>Overseas Agency</h2>
          <p>
            Foreign travel agencies request quotations, sell locally, upload rooming lists,
            confirm bookings, and pay invoices.
          </p>
        </article>
        <article className="panel">
          <span className="badge warning">Supply Side</span>
          <h2>Domestic Supplier</h2>
          <p>
            Korea-side hotels, coaches, restaurants, attractions, guides, and other vendors
            provide cost data and receive booking/change/cancel/confirmation messages.
          </p>
        </article>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>V1 Milestones</h2>
        <ul>
          {v1Milestones.map((milestone) => (
            <li key={milestone}>{milestone}</li>
          ))}
        </ul>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Internal Admin</h2>
          <span>{adminRoutes.length} workspaces</span>
        </div>
        <RouteCardGrid routes={adminRoutes} />
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Overseas Agency Portal</h2>
          <span>{agencyRoutes.length} workspaces</span>
        </div>
        <RouteCardGrid routes={agencyRoutes} />
      </section>
    </>
  );
}

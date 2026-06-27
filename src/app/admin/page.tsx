import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import { adminRoutes } from "@/features/v1/site-map";

export default function AdminPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">JHT Internal</p>
          <h1>Internal Admin</h1>
          <p>
            Workbench for sales, operations, booking teams, finance, automation review,
            migration, and audit. Domestic Supplier and Overseas Agency data stay separated.
          </p>
        </div>
      </div>
      <section className="action-band">
        <div>
          <h2>Version 1 Build Map</h2>
          <p>
            Start with supplier master data, then connect agency inquiries, quote snapshots,
            reservations, task reminders, supplier messages, and finance.
          </p>
        </div>
        <span className="status-dot status-live">In Progress</span>
      </section>
      <RouteCardGrid routes={adminRoutes} />
    </>
  );
}

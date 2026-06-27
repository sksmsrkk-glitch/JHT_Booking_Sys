import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import { adminRoutes } from "@/features/v1/site-map";

export default function AdminPage() {
  const primaryTitles = ["Quote Cases", "Reservations", "Domestic Suppliers", "Overseas Agencies"];
  const primaryRoutes = primaryTitles
    .map((title) => adminRoutes.find((route) => route.title === title))
    .filter((route): route is (typeof adminRoutes)[number] => Boolean(route));
  const secondaryRoutes = adminRoutes.filter((route) => !primaryRoutes.includes(route));

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">JHT Internal</p>
          <h1>Internal Admin</h1>
          <p>Start with quotes, reservations, suppliers, and agencies. Support tools stay one level down.</p>
        </div>
      </div>
      <section className="action-band">
        <div>
          <h2>Main Workflow</h2>
          <p>Request to quote, quote to reservation, reservation to supplier operations, invoice, and settlement.</p>
        </div>
        <span className="status-dot status-live">Live</span>
      </section>
      <RouteCardGrid routes={primaryRoutes} />
      <section className="section-block">
        <div className="section-heading">
          <h2>Support Tools</h2>
          <span>{secondaryRoutes.length} tools</span>
        </div>
        <RouteCardGrid routes={secondaryRoutes} density="compact" />
      </section>
    </>
  );
}

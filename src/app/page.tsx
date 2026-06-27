import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import { adminRoutes, agencyRoutes } from "@/features/v1/site-map";

export default function HomePage() {
  const primaryTitles = ["Quote Cases", "Reservations", "Domestic Suppliers", "Overseas Agencies"];
  const primaryAdminRoutes = primaryTitles
    .map((title) => adminRoutes.find((route) => route.title === title))
    .filter((route): route is (typeof adminRoutes)[number] => Boolean(route));

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">JHT Booking Engine</p>
          <h1>Jungho Travel Operations Platform</h1>
          <p>Quote, book, operate, invoice, and settle inbound travel programs in one controlled workspace.</p>
        </div>
      </div>
      <section className="section-block">
        <div className="section-heading">
          <h2>Internal Workbench</h2>
          <span>Core flow</span>
        </div>
        <RouteCardGrid routes={primaryAdminRoutes} />
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Overseas Agency Portal</h2>
          <span>{agencyRoutes.length} workspaces</span>
        </div>
        <RouteCardGrid routes={agencyRoutes} density="compact" />
      </section>
    </>
  );
}

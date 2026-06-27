import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import { agencyRoutes } from "@/features/v1/site-map";

export default function AgencyPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Customer Portal</p>
          <h1>Overseas Agency Portal</h1>
          <p>
            Portal for foreign agency customers to create inquiries, review safe quote
            summaries, request bookings, upload rooming lists, and check invoices.
          </p>
        </div>
      </div>
      <section className="notice">
        <h2>Customer-safe view</h2>
        <p>
          Domestic supplier costs, margins, internal operation tasks, supplier message outbox,
          expenses, shopping commissions, and settlements are intentionally hidden.
        </p>
      </section>
      <RouteCardGrid routes={agencyRoutes} />
    </>
  );
}

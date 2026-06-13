const agencyWorkflows = [
  "Create new inquiry",
  "Review shared quote",
  "Request revision or cancellation",
  "Request booking confirmation",
  "Upload rooming list",
  "Review invoice and payment status"
];

export default function AgencyPage() {
  return (
    <>
      <h1>Overseas Agency Portal</h1>
      <p>
        Portal for foreign agency customers. Domestic supplier costs, margins, internal
        operation tasks, and settlement details are intentionally hidden.
      </p>
      <section className="grid">
        {agencyWorkflows.map((workflow) => (
          <article className="panel" key={workflow}>
            <h2>{workflow}</h2>
            <p>Connected to agency-scoped API contracts with Supabase RLS.</p>
          </article>
        ))}
      </section>
    </>
  );
}

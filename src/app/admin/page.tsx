const adminWorkflows = [
  "Search domestic supplier costs",
  "Create quote cases and quote versions",
  "Generate reservations after agency acceptance",
  "Create operation tasks and reminders",
  "Draft and approve supplier email/Kakao messages",
  "Record invoices, payments, expenses, shopping commissions, and settlement"
];

export default function AdminPage() {
  return (
    <>
      <h1>Internal Admin</h1>
      <p>
        Internal workspace for sales, operations, hotel booking, vehicle booking, guide
        assignment, content booking, and finance teams.
      </p>
      <section className="grid">
        {adminWorkflows.map((workflow) => (
          <article className="panel" key={workflow}>
            <h2>{workflow}</h2>
            <p>Status: scaffolded API and database contracts are ready for UI implementation.</p>
          </article>
        ))}
      </section>
    </>
  );
}

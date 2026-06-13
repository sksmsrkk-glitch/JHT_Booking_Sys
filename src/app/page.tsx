const modules = [
  "Overseas Agency inquiries and quote sharing",
  "Domestic Supplier products, prices, media, and booking messages",
  "Quotation snapshots with margin control",
  "Reservation status history and rooming lists",
  "Operation task reminders by team",
  "Finance, shopping commissions, and settlement"
];

export default function HomePage() {
  return (
    <>
      <h1>Jungho Travel Operations Platform</h1>
      <p>
        Foundation scaffold for the inbound travel operating system. The business boundary
        between overseas agency customers and Korean domestic suppliers is enforced in schema,
        routes, and naming.
      </p>
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
        <h2>Implemented Modules</h2>
        <ul>
          {modules.map((module) => (
            <li key={module}>{module}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function RouteLoadingShell({ label = "Loading workspace" }: { label?: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="route-loading-shell" role="status">
      <div className="route-loading-heading">
        <span className="route-loading-line route-loading-line-short" />
        <span className="route-loading-line route-loading-line-title" />
        <span className="route-loading-line route-loading-line-copy" />
      </div>
      <div className="route-loading-toolbar">
        <span />
        <span />
        <span />
      </div>
      <div className="route-loading-table">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </section>
  );
}

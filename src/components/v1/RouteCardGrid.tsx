import Link from "next/link";
import type { V1RouteCard } from "@/features/v1/site-map";

export function RouteCardGrid({ routes }: { routes: V1RouteCard[] }) {
  return (
    <section className="route-grid">
      {routes.map((route) => (
        <Link className="route-card" href={route.href} key={route.title}>
          <div className="split-row">
            <h2>{route.title}</h2>
            <span className={`status-dot status-${route.status}`}>{formatLabel(route.status)}</span>
          </div>
          <p>{route.description}</p>
          <span className="subtext">Owner: {route.owner}</span>
        </Link>
      ))}
    </section>
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

import Link from "next/link";
import type { V1RouteCard } from "@/features/v1/site-map";

export function RouteCardGrid({
  routes,
  density = "standard"
}: {
  routes: V1RouteCard[];
  density?: "standard" | "compact";
}) {
  return (
    <section className={`route-grid route-grid-${density}`}>
      {routes.map((route) => (
        <Link className={`route-card route-card-${density}`} href={route.href} key={route.title}>
          <div className="split-row">
            <h2>{route.title}</h2>
            <span className={`status-dot status-${route.status}`}>{formatLabel(route.status)}</span>
          </div>
          {density === "standard" ? <p>{route.description}</p> : null}
          <span className="subtext">{density === "standard" ? `Owner: ${route.owner}` : route.owner}</span>
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

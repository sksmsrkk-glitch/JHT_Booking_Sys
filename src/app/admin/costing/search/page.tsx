/**
 * @file 한글 책임: Next.js App Router의 `/admin/costing/search` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { SUPPLIER_CATEGORIES } from "@/features/supplier/queries";
import type { CostSearchItem } from "@/features/costing/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  category?: string;
  region?: string;
}>;

type LoadState =
  | { status: "ready"; items: CostSearchItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;
const quoteCasesRoute = "/admin/quote-cases" as Route;

export default async function AdminCostSearchPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadCostItems(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Cost Search</h1>
          <p>
            Search active Domestic Supplier products and prices before creating immutable
            quote item snapshots.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/costing/search">
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Hotel, room, restaurant, vehicle"
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={filters.category ?? ""}>
            <option value="">All categories</option>
            {SUPPLIER_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region
          <input name="region" defaultValue={filters.region ?? ""} placeholder="Seoul, Busan" />
        </label>
        <button className="button-primary" type="submit">
          Search
        </button>
      </form>

      <section className="action-band">
        <div>
          <h2>Snapshot Handoff</h2>
          <p>
            Use these rows as source data for quote item snapshots. Old quote items must not
            change when supplier prices are updated later.
          </p>
        </div>
        <Link className="button-primary" href={quoteCasesRoute}>
          Open Quotes
        </Link>
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Cost items could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <CostSearchResults items={loadState.items} /> : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Cost search is internal-only and reads Domestic Supplier product/price data.</li>
          <li>Agency Portal cannot query supplier_prices or quote_items.</li>
          <li>Selected rows must be copied into quote item snapshot fields when saved.</li>
        </ul>
      </section>
    </>
  );
}

function CostSearchResults({ items }: { items: CostSearchItem[] }) {
  if (items.length === 0) {
    return (
      <section className="empty-state">
        <h2>No cost items found</h2>
        <p>Adjust the keyword, category, or region filters.</p>
      </section>
    );
  }

  return (
    <section className="stack">
      {items.map((item) => (
        <article className="panel" key={item.id}>
          <div className="split-row">
            <div>
              <h2>{item.name_ko}</h2>
              <p className="subtext">
                {item.domestic_suppliers.name_ko} / {formatLabel(item.product_type)}
              </p>
            </div>
            <span className="status-dot status-active">{formatLabel(item.domestic_suppliers.category)}</span>
          </div>
          <dl className="definition-list columns">
            <div>
              <dt>Region</dt>
              <dd>{formatRegion(item.domestic_suppliers.region_level1, item.domestic_suppliers.region_level2)}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>{item.capacity ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{item.room_type ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Vehicle Seats</dt>
              <dd>{item.vehicle_seat_count ?? "Not set"}</dd>
            </div>
          </dl>
          <PriceRows prices={item.supplier_prices ?? []} />
        </article>
      ))}
    </section>
  );
}

function PriceRows({ prices }: { prices: CostSearchItem["supplier_prices"] }) {
  const activePrices = prices.filter((price) => price.status === "active");
  if (activePrices.length === 0) {
    return <p className="subtext">No active prices are registered for this product.</p>;
  }

  return (
    <div className="table-shell nested">
      <table>
        <thead>
          <tr>
            <th>Snapshot Item</th>
            <th>Cost</th>
            <th>Unit</th>
            <th>Pax</th>
            <th>Season</th>
            <th>Validity</th>
          </tr>
        </thead>
        <tbody>
          {activePrices.map((price) => (
            <tr key={price.id}>
              <td>{price.id}</td>
              <td>
                {price.currency} {Number(price.cost_amount).toLocaleString()}
              </td>
              <td>{formatLabel(price.pricing_unit)}</td>
              <td>{formatPax(price.min_pax, price.max_pax)}</td>
              <td>{price.season_label ?? "Not set"}</td>
              <td>{formatDateRange(price.valid_from, price.valid_to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function loadCostItems(filters: { q?: string; category?: string; region?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads cost items through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/cost-items/search", filters, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown cost search API error"
    };
  }

  return { status: "ready", items: payload.data ?? [] };
}

function buildInternalApiUrl(
  path: string,
  filters: { q?: string; category?: string; region?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.category) url.searchParams.set("category", filters.category);
  if (filters.region) url.searchParams.set("region", filters.region);
  return url;
}

function formatRegion(regionLevel1: string | null, regionLevel2: string | null) {
  return [regionLevel1, regionLevel2].filter(Boolean).join(" / ") || "Unassigned";
}

function formatPax(minPax: number | null, maxPax: number | null) {
  if (minPax && maxPax) return `${minPax}-${maxPax}`;
  if (minPax) return `${minPax}+`;
  if (maxPax) return `Up to ${maxPax}`;
  return "Any";
}

function formatDateRange(validFrom: string | null, validTo: string | null) {
  if (validFrom && validTo) return `${validFrom} - ${validTo}`;
  if (validFrom) return `From ${validFrom}`;
  if (validTo) return `Until ${validTo}`;
  return "Open";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

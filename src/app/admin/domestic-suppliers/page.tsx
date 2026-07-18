/**
 * @file 한글 책임: Next.js App Router의 `/admin/domestic-suppliers` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { SUPPLIER_CATEGORIES, RECORD_STATUSES } from "@/features/supplier/queries";
import type { SupplierListItem } from "@/features/supplier/types";
import { DomesticSupplierCreateForm } from "@/components/admin/MasterDataCreateForms";
import { CostMasterQuickCreateForm, CostMasterSearchPanel } from "@/components/admin/DomesticSupplierCostMasterForms";
import { DomesticSupplierExcelActions } from "@/components/admin/DomesticSupplierExcelActions";
import type { CompanyListItem } from "@/features/company/types";
import { PaginationControls } from "@/components/PaginationControls";
import type { PaginationMeta } from "@/lib/api/pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  category?: string;
  status?: string;
  costKind?: string;
  menuRows?: string;
  attractionRows?: string;
  page?: string;
  pageSize?: string;
}>;

const adminRoute = "/admin" as Route;

type LoadState =
  | { status: "ready"; suppliers: SupplierListItem[]; companies: CompanyListItem[]; pagination: PaginationMeta }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

export default async function DomesticSuppliersPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const filters = await searchParams;
  const loadState = await loadSuppliers(filters);
  const selectedStatus = filters.status ?? "active";
  const selectedCostKind = normalizeCostKind(filters.costKind);
  const selectedMenuRows = normalizeMenuRows(filters.menuRows);
  const selectedAttractionRows = normalizeRows(filters.attractionRows);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Domestic Suppliers</h1>
          <p>
            Korea-side suppliers and cost providers for hotels, vehicles, restaurants,
            attractions, guides, shopping, and local partners.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/domestic-suppliers">
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Supplier, region, keyword"
          />
        </label>
        <input name="page" type="hidden" value="1" />
        <input name="pageSize" type="hidden" value={filters.pageSize ?? "20"} />
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
          Status
          <select name="status" defaultValue={selectedStatus}>
            {RECORD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Excel Import / Export</h2>
          <span>Template, bulk upload, full export</span>
        </div>
        <DomesticSupplierExcelActions companies={loadState.status === "ready" ? loadState.companies : []} />
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Cost Master Quick Create</h2>
          <span>Supplier + item + price</span>
        </div>
        <CostMasterQuickCreateForm
          companies={loadState.status === "ready" ? loadState.companies : []}
          initialKind={selectedCostKind}
          initialMenuRows={selectedMenuRows}
          initialAttractionRows={selectedAttractionRows}
        />
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Search Cost Items</h2>
          <span>Keyword / category lookup</span>
        </div>
        <CostMasterSearchPanel />
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Add Supplier Only</h2>
          <span>Profile without cost rows</span>
        </div>
        <DomesticSupplierCreateForm companies={loadState.status === "ready" ? loadState.companies : []} />
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Supplier data could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <>
          <SupplierTable suppliers={loadState.suppliers} />
          <PaginationControls
            action="/admin/domestic-suppliers"
            pagination={loadState.pagination}
            searchParams={{ q: filters.q, category: filters.category, status: selectedStatus }}
          />
        </>
      ) : null}
    </>
  );
}

function SupplierTable({ suppliers }: { suppliers: SupplierListItem[] }) {
  if (suppliers.length === 0) {
    return (
      <section className="empty-state">
        <h2>No domestic suppliers found</h2>
        <p>Add supplier master data or adjust the current filters.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Domestic supplier list">
      <table>
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Category</th>
            <th>Region</th>
            <th>Contacts</th>
            <th>Products</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>
                <Link
                  className="strong-link"
                  href={`/admin/domestic-suppliers/${supplier.id}` as Route}
                >
                  {supplier.nameKo}
                </Link>
                {supplier.nameEn ? <span className="subtext">{supplier.nameEn}</span> : null}
              </td>
              <td>{formatLabel(supplier.category)}</td>
              <td>{formatRegion(supplier.regionLevel1, supplier.regionLevel2)}</td>
              <td>{supplier.contactCount}</td>
              <td>{supplier.productCount}</td>
              <td>
                <span className={`status-dot status-${supplier.status}`}>{formatLabel(supplier.status)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadSuppliers(filters: { q?: string; category?: string; status?: string; page?: string; pageSize?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads supplier data through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [supplierResponse, companyResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/domestic-suppliers", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/companies", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [supplierPayload, companyPayload] = await Promise.all([supplierResponse.json(), companyResponse.json()]);

  const failedResponse = [supplierResponse, companyResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message: supplierPayload.error ?? companyPayload.error ?? "Unknown supplier API error"
    };
  }

  return {
    status: "ready",
    suppliers: supplierPayload.data ?? [],
    companies: companyPayload.data ?? [],
    pagination: supplierPayload.pagination
  };
}

function buildInternalApiUrl(
  path: string,
  filters: { q?: string; category?: string; status?: string; page?: string; pageSize?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.category) url.searchParams.set("category", filters.category);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.page) url.searchParams.set("page", filters.page);
  if (filters.pageSize) url.searchParams.set("pageSize", filters.pageSize);
  return url;
}

function formatRegion(regionLevel1: string | null, regionLevel2: string | null) {
  return [regionLevel1, regionLevel2].filter(Boolean).join(" / ") || "Unassigned";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeCostKind(value: string | undefined) {
  const allowed = ["hotel", "vehicle", "restaurant", "attraction", "guide", "other", "incentive_banquet"] as const;
  return allowed.includes(value as any) ? (value as (typeof allowed)[number]) : "hotel";
}

function normalizeMenuRows(value: string | undefined) {
  return normalizeRows(value);
}

function normalizeRows(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 30);
}

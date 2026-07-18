/**
 * @file 한글 책임: Next.js App Router의 `/admin/domestic-suppliers/[supplierId]` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SupplierContactCreateForm } from "@/components/admin/SupplierContactCreateForm";
import { SupplierPriceCreateForm, SupplierProductCreateForm } from "@/components/admin/SupplierProductPriceForms";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { SupplierDetail } from "@/features/supplier/types";

export const dynamic = "force-dynamic";

const domesticSuppliersRoute = "/admin/domestic-suppliers" as Route;

type PageProps = {
  params: Promise<{ supplierId: string }>;
};

type LoadState =
  | { status: "ready"; supplier: SupplierDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

/**
 * 국내 공급사의 연락처, 상품, 반복 가격 규칙 및 미디어를 공급사 ID 경계로 조회합니다.
 * 호텔·식사·관광지처럼 가격 구조가 다른 상품도 공통 상품 아래의 타입별 스펙으로 구분해 표시합니다.
 */
export default async function DomesticSupplierDetailPage({ params }: PageProps) {
  const { supplierId } = await params;
  const loadState = await loadSupplier(supplierId);

  if (loadState.status === "not-found") {
    notFound();
  }

  if (loadState.status === "auth-required") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Domestic Supplier</p>
            <h1>Internal role required</h1>
            <p>{loadState.message}</p>
          </div>
          <Link className="button-secondary" href={domesticSuppliersRoute}>
            Back to Suppliers
          </Link>
        </div>
        <section className="notice warning">
          <h2>Supplier detail is protected</h2>
          <p>Domestic supplier master data is internal-only and never exposed to Agency Portal users.</p>
        </section>
      </>
    );
  }

  if (loadState.status === "error") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Domestic Supplier</p>
            <h1>Supplier data could not load</h1>
            <p>{loadState.message}</p>
          </div>
          <Link className="button-secondary" href={domesticSuppliersRoute}>
            Back to Suppliers
          </Link>
        </div>
      </>
    );
  }

  const supplier = loadState.supplier;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">{formatLabel(supplier.category)}</p>
          <h1>{supplier.nameKo}</h1>
          <p>{supplier.nameEn ?? "English name is not set"}</p>
        </div>
        <Link className="button-secondary" href={domesticSuppliersRoute}>
          Back to Suppliers
        </Link>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Supplier Profile</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>{formatLabel(supplier.status)}</dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>{formatRegion(supplier.regionLevel1, supplier.regionLevel2)}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{supplier.address ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{supplier.phone ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>{supplier.website ?? "Not set"}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h2>Map References</h2>
          <dl className="definition-list">
            <div>
              <dt>Google Place ID</dt>
              <dd>{supplier.googlePlaceId ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Naver Map URL</dt>
              <dd>{supplier.naverMapUrl ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>{formatCoordinates(supplier.latitude, supplier.longitude)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Contacts</h2>
          <span>{supplier.contacts.length} records</span>
        </div>
        <section className="panel-section">
          <h2>Add Contact</h2>
          <SupplierContactCreateForm supplierId={supplier.id} />
        </section>
        {supplier.contacts.length === 0 ? (
          <div className="empty-state compact">
            <p>No supplier contacts are registered.</p>
          </div>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Kakao</th>
                  <th>Booking Messages</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {supplier.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.name}</td>
                    <td>{contact.title ?? "Not set"}</td>
                    <td>{contact.email ?? "Not set"}</td>
                    <td>{contact.phone ?? "Not set"}</td>
                    <td>{contact.kakaoAvailable ? "Available" : "No"}</td>
                    <td>{contact.receivesBookingMessages ? "Receives" : "Disabled"}</td>
                    <td>{contact.notes ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Products and Prices</h2>
          <span>{supplier.products.length} products</span>
        </div>
        <section className="panel-section">
          <h2>Add Product</h2>
          <SupplierProductCreateForm supplierId={supplier.id} />
        </section>
        {supplier.products.length === 0 ? (
          <div className="empty-state compact">
            <p>No products are registered for this domestic supplier.</p>
          </div>
        ) : (
          <div className="stack">
            {supplier.products.map((product) => (
              <article className="panel" key={product.id}>
                <div className="split-row">
                  <div>
                    <h3>{product.nameKo}</h3>
                    <p className="subtext">{product.searchName}</p>
                  </div>
                  <span className={`status-dot status-${product.status}`}>{formatLabel(product.status)}</span>
                </div>
                <dl className="definition-list columns">
                  <div>
                    <dt>Type</dt>
                    <dd>{formatLabel(product.productType)}</dd>
                  </div>
                  <div>
                    <dt>Capacity</dt>
                    <dd>{product.capacity ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Room</dt>
                    <dd>{product.roomType ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Vehicle Seats</dt>
                    <dd>{product.vehicleSeatCount ?? "Not set"}</dd>
                  </div>
                </dl>
                <SupplierPriceCreateForm productId={product.id} />
                <PriceTable prices={product.prices} />
              </article>
            ))}
          </div>
        )}
      </section>

      {supplier.internalNotes ? (
        <section className="notice">
          <h2>Internal Notes</h2>
          <p>{supplier.internalNotes}</p>
        </section>
      ) : null}
    </>
  );
}

/** 기간·요일·인원·객실 또는 티켓 조건이 다른 가격 행을 손실 없이 비교 가능한 표로 표시합니다. */
function PriceTable({ prices }: { prices: SupplierDetail["products"][number]["prices"] }) {
  if (prices.length === 0) {
    return <p className="subtext">No active or archived prices are registered.</p>;
  }

  return (
    <div className="table-shell nested">
      <table>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Cost</th>
            <th>Pax</th>
            <th>Season</th>
            <th>Validity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((price) => (
            <tr key={price.id}>
              <td>{formatLabel(price.pricingUnit)}</td>
              <td>
                {price.currency} {price.costAmount.toLocaleString()}
              </td>
              <td>{formatPax(price.minPax, price.maxPax)}</td>
              <td>{price.seasonLabel ?? "Not set"}</td>
              <td>{formatDateRange(price.validFrom, price.validTo)}</td>
              <td>{formatLabel(price.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function loadSupplier(supplierId: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads supplier detail through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl(`/api/domestic-suppliers/${supplierId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (response.status === 404) {
    return { status: "not-found" };
  }

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown supplier API error"
    };
  }

  return { status: "ready", supplier: payload.data };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatRegion(regionLevel1: string | null, regionLevel2: string | null) {
  return [regionLevel1, regionLevel2].filter(Boolean).join(" / ") || "Unassigned";
}

function formatCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return "Not set";
  return `${latitude}, ${longitude}`;
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

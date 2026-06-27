import type { Route } from "next";
import Link from "next/link";
import { FinanceAdjustmentForms } from "@/components/admin/FinanceAdjustmentForms";
import { SettlementStatusActions } from "@/components/admin/SettlementStatusActions";
import { SETTLEMENT_STATUSES } from "@/features/finance/queries";
import type { SettlementListItem } from "@/features/finance/types";
import type { ReservationListItem } from "@/features/reservation/types";
import type { SupplierListItem } from "@/features/supplier/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;

type LoadState =
  | {
      status: "ready";
      settlements: SettlementListItem[];
      reservations: ReservationListItem[];
      suppliers: SupplierListItem[];
    }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const financeRoute = "/admin/finance/invoices" as Route;

export default async function AdminSettlementsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadSettlements(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Finance</p>
          <h1>Settlements</h1>
          <p>Reservation-level invoice, payment, expense, revenue, commission, and profit summary.</p>
        </div>
        <Link className="button-secondary" href={financeRoute}>
          Back to Invoices
        </Link>
      </div>

      <form className="toolbar" action="/admin/finance/settlements">
        <label>
          Search
          <input name="q" defaultValue={filters.q ?? ""} placeholder="Reservation, agency, tour" type="search" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {SETTLEMENT_STATUSES.map((status) => (
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

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Finance role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Settlements could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <SettlementTable settlements={loadState.settlements} /> : null}

      <FinanceAdjustmentForms
        reservations={loadState.status === "ready" ? loadState.reservations : []}
        suppliers={loadState.status === "ready" ? loadState.suppliers : []}
      />

      <section className="notice">
        <h2>Internal finance boundary</h2>
        <ul className="clean-list">
          <li>Settlements are finance/admin-only.</li>
          <li>Expenses, extra revenues, and shopping commissions are not Agency-visible.</li>
          <li>Approval and close actions remain high-risk and must be audit logged.</li>
        </ul>
      </section>
    </>
  );
}

function SettlementTable({ settlements }: { settlements: SettlementListItem[] }) {
  if (settlements.length === 0) {
    return (
      <section className="empty-state">
        <h2>No settlements found</h2>
        <p>Draft settlements will appear after finance creates reservation closing records.</p>
      </section>
    );
  }

  const totalProfit = settlements.reduce((sum, settlement) => sum + settlement.finalProfitAmount, 0);

  return (
    <>
      <section className="metric-row">
        <article className="metric-card">
          <span>Settlements</span>
          <strong>{settlements.length}</strong>
        </article>
        <article className="metric-card">
          <span>Final Profit</span>
          <strong>{totalProfit.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>Approved</span>
          <strong>{settlements.filter((settlement) => settlement.status === "approved").length}</strong>
        </article>
      </section>
      <section className="table-shell" aria-label="Settlement list">
        <table>
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Agency</th>
              <th>Status</th>
              <th>Invoice</th>
              <th>Payment</th>
              <th>Expense</th>
              <th>Extra/Commission</th>
              <th>Profit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((settlement) => (
              <tr key={settlement.id}>
                <td>
                  <strong>{settlement.reservationCode ?? settlement.reservationId}</strong>
                  {settlement.tourName ? <span className="subtext">{settlement.tourName}</span> : null}
                </td>
                <td>{settlement.agencyName ?? "Not set"}</td>
                <td>
                  <span className={`status-dot status-${settlement.status}`}>{formatLabel(settlement.status)}</span>
                  {settlement.approvedAt ? <span className="subtext">Approved {formatDateTime(settlement.approvedAt)}</span> : null}
                </td>
                <td>{settlement.totalInvoiceAmount.toLocaleString()}</td>
                <td>{settlement.totalPaymentAmount.toLocaleString()}</td>
                <td>{settlement.totalExpenseAmount.toLocaleString()}</td>
                <td>
                  {settlement.totalExtraRevenueAmount.toLocaleString()}
                  <span className="subtext">Commission {settlement.totalShoppingCommissionAmount.toLocaleString()}</span>
                </td>
                <td>{settlement.finalProfitAmount.toLocaleString()}</td>
                <td>
                  <SettlementStatusActions settlementId={settlement.id} status={settlement.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

async function loadSettlements(filters: { q?: string; status?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message: "This page reads settlements through the finance API, which requires finance/admin role."
    };
  }

  const [settlementResponse, reservationResponse, supplierResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/finance/settlements", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/reservations", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/domestic-suppliers", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [settlementPayload, reservationPayload, supplierPayload] = await Promise.all([
    settlementResponse.json(),
    reservationResponse.json(),
    supplierResponse.json()
  ]);

  const failedResponse = [settlementResponse, reservationResponse, supplierResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message:
        settlementPayload.error ??
        reservationPayload.error ??
        supplierPayload.error ??
        "Unknown settlements API error"
    };
  }

  return {
    status: "ready",
    settlements: settlementPayload.data ?? [],
    reservations: reservationPayload.data ?? [],
    suppliers: supplierPayload.data ?? []
  };
}

function buildInternalApiUrl(path: string, filters: { q?: string; status?: string }, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.status) url.searchParams.set("status", filters.status);
  return url;
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * @file 한글 책임: Next.js App Router의 `/admin/migrations/notion-csv` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { MIGRATION_STATUSES, NOTION_CSV_TARGET_TABLES } from "@/features/migration/queries";
import type { MigrationBatchListItem } from "@/features/migration/types";
import { MigrationBatchActions } from "@/components/admin/MigrationBatchActions";
import { NotionCsvStagingForm } from "@/components/admin/NotionCsvStagingForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; targetTable?: string }>;

type LoadState =
  | { status: "ready"; batches: MigrationBatchListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminNotionCsvMigrationPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadBatches(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Notion CSV Migration</h1>
          <p>
            Controlled staging workflow for importing legacy Notion CSV rows into approved
            operating tables.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/migrations/notion-csv">
        <label>
          Target Table
          <select name="targetTable" defaultValue={filters.targetTable ?? ""}>
            <option value="">All targets</option>
            {NOTION_CSV_TARGET_TABLES.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {MIGRATION_STATUSES.map((status) => (
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

      <section className="action-band">
        <div>
          <h2>Staging Upload Contract</h2>
          <p>
            `POST /api/migrations/notion-csv` accepts sourceName, targetTable, and rows. Validate
            each batch before approval so import stays behind an audited gate.
          </p>
        </div>
        <span className="status-dot status-ready">Staging Ready</span>
      </section>

      <NotionCsvStagingForm />

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Migration data could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <MigrationTable batches={loadState.batches} /> : null}

      <section className="notice">
        <h2>Migration Guardrails</h2>
        <ul className="clean-list">
          <li>Only allowlisted target tables can be staged.</li>
          <li>Agency and Domestic Supplier records must remain separate during mapping.</li>
          <li>Production import requires validation, approval, and high-risk audit evidence.</li>
        </ul>
      </section>
    </>
  );
}

function MigrationTable({ batches }: { batches: MigrationBatchListItem[] }) {
  if (batches.length === 0) {
    return (
      <section className="empty-state">
        <h2>No migration batches found</h2>
        <p>Staged Notion CSV uploads will appear here.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Migration batches">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Target</th>
            <th>Status</th>
            <th>Rows</th>
            <th>Errors</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td>
                <strong>{batch.sourceName}</strong>
                <span className="subtext">{batch.sourceKind}</span>
              </td>
              <td>{batch.targetTable}</td>
              <td>
                <span className={`status-dot status-${batch.status}`}>{formatLabel(batch.status)}</span>
              </td>
              <td>{batch.rowCount}</td>
              <td>{batch.errorCount}</td>
              <td>{formatDateTime(batch.updatedAt)}</td>
              <td>
                <MigrationBatchActions batchId={batch.id} errorCount={batch.errorCount} status={batch.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadBatches(filters: { status?: string; targetTable?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads migration data through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/migrations/notion-csv/batches", filters, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown migration API error"
    };
  }

  return { status: "ready", batches: payload.data ?? [] };
}

function buildInternalApiUrl(path: string, filters: { status?: string; targetTable?: string }, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.targetTable) url.searchParams.set("targetTable", filters.targetTable);
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

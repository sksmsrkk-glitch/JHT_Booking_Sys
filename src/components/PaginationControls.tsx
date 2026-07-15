import type { Route } from "next";
import Link from "next/link";

import type { PaginationMeta } from "@/lib/api/pagination";

type PaginationControlsProps = {
  action: string;
  pagination: PaginationMeta;
  searchParams?: Record<string, string | number | null | undefined>;
};

const pageSizeOptions = [20, 50, 100];

/** 서버 목록과 URL 상태를 함께 유지하는 공통 페이지 이동 컨트롤입니다. */
export function PaginationControls({ action, pagination, searchParams = {} }: PaginationControlsProps) {
  const previousHref = buildHref(action, searchParams, pagination.page - 1, pagination.pageSize);
  const nextHref = buildHref(action, searchParams, pagination.page + 1, pagination.pageSize);

  return (
    <nav className="pagination-controls" aria-label="List pagination">
      <div className="pagination-summary">
        <strong>{pagination.total.toLocaleString()}</strong> records
        <span>
          Page {pagination.page.toLocaleString()} of {pagination.totalPages.toLocaleString()}
        </span>
      </div>
      <div className="pagination-actions">
        {pagination.hasPrevious ? (
          <Link className="button-secondary mini-button" href={previousHref as Route}>
            Previous
          </Link>
        ) : (
          <span className="button-secondary mini-button disabled-control" aria-disabled="true">
            Previous
          </span>
        )}
        <form action={action} className="pagination-size-form">
          {Object.entries(searchParams).map(([key, value]) =>
            value !== undefined && value !== null && value !== "" && !["page", "pageSize"].includes(key) ? (
              <input key={key} name={key} type="hidden" value={String(value)} />
            ) : null
          )}
          <input name="page" type="hidden" value="1" />
          <label>
            Rows
            <select name="pageSize" defaultValue={String(pagination.pageSize)}>
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button className="button-secondary mini-button" type="submit">
            Apply
          </button>
        </form>
        {pagination.hasNext ? (
          <Link className="button-secondary mini-button" href={nextHref as Route}>
            Next
          </Link>
        ) : (
          <span className="button-secondary mini-button disabled-control" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

function buildHref(
  action: string,
  searchParams: Record<string, string | number | null | undefined>,
  page: number,
  pageSize: number
) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && !["page", "pageSize"].includes(key)) {
      params.set(key, String(value));
    }
  });
  params.set("page", String(Math.max(1, page)));
  params.set("pageSize", String(pageSize));
  return `${action}?${params.toString()}`;
}

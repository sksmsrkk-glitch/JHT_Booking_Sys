/**
 * @file 한글 책임: Next.js App Router의 `/admin/workflows` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getWorkflowDateKey, normalizeWorkflowFilters, type WorkflowFilters } from "@/features/workflow/filters";
import { listWorkflowThreadPage } from "@/features/workflow/queries";
import type { WorkflowThreadSummary } from "@/features/workflow/types";
import { normalizeLocale } from "@/lib/i18n";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, parsePagination, type PaginationMeta } from "@/lib/api/pagination";
import { classifyPageDataError, getInternalPageContext } from "@/lib/api/server-page-context";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  partner?: string;
  tourCode?: string;
  group?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function AdminWorkflowsPage({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("jht_locale")?.value);
  const rawSearchParams = await searchParams;
  const filters = normalizeWorkflowFilters(rawSearchParams);
  const loadState = await loadWorkflows(filters, rawSearchParams);
  const workflows = loadState.workflows;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">{locale === "ko" ? "내부 관리자" : "Internal Admin"}</p>
          <h1>{locale === "ko" ? "파트너 소통 워크플로우" : "Workflow Communication"}</h1>
          <p>
            {locale === "ko"
              ? "문의, 견적, 확정서, 예약, 인보이스, 정산, 가이드 지출까지 하나의 코드로 묶는 커뮤니케이션 원장입니다."
              : "One communication ledger for each inquiry, quote, confirmation, invoice, finance, and guide expense code."}
          </p>
        </div>
        <Link className="button-secondary" href={"/admin" as Route}>
          {locale === "ko" ? "대시보드" : "Dashboard"}
        </Link>
      </div>

      {loadState.previewMode ? (
        <section className="notice warning">
          <h2>{locale === "ko" ? "미리보기 데이터" : "Preview data"}</h2>
          <p>
            {locale === "ko"
              ? "Supabase 로그인이 활성화되지 않아 샘플 워크플로우 커뮤니케이션 목록을 표시합니다."
              : "Supabase login is not active, so sample workflow communication rows are shown."}
          </p>
        </section>
      ) : null}

      {loadState.error ? (
        <section className="notice warning">
          <h2>{locale === "ko" ? "워크플로우를 불러오지 못했습니다" : "Workflows could not load"}</h2>
          <p>{loadState.error}</p>
        </section>
      ) : null}

      <WorkflowFilterBar filters={filters} locale={locale} totalCount={loadState.pagination.total} visibleCount={workflows.length} />
      <WorkflowList locale={locale} workflows={workflows} />
      <PaginationControls
        action="/admin/workflows"
        pagination={loadState.pagination}
        searchParams={{ ...filters }}
      />
    </>
  );
}

function WorkflowFilterBar({
  filters,
  locale,
  totalCount,
  visibleCount
}: {
  filters: WorkflowFilters;
  locale: "en" | "ko";
  totalCount: number;
  visibleCount: number;
}) {
  return (
    <section className="workflow-filter-shell" aria-label={locale === "ko" ? "워크플로우 검색" : "Workflow search"}>
      <form action="/admin/workflows" className="workflow-filter-bar">
        <label>
          {locale === "ko" ? "시작일" : "From"}
          <input name="from" type="date" defaultValue={filters.from ?? ""} />
        </label>
        <label>
          {locale === "ko" ? "종료일" : "To"}
          <input name="to" type="date" defaultValue={filters.to ?? ""} />
        </label>
        <label>
          {locale === "ko" ? "파트너사명" : "Partner"}
          <input name="partner" placeholder={locale === "ko" ? "파트너사 검색" : "Partner name"} defaultValue={filters.partner ?? ""} />
        </label>
        <label>
          {locale === "ko" ? "투어코드" : "Tour code"}
          <input name="tourCode" placeholder="Q-2026-TH-001" defaultValue={filters.tourCode ?? ""} />
        </label>
        <label>
          {locale === "ko" ? "단체명" : "Group name"}
          <input name="group" placeholder={locale === "ko" ? "단체명 검색" : "Group name"} defaultValue={filters.group ?? ""} />
        </label>
        <div className="workflow-filter-actions">
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value="20" />
          <button className="button-primary" type="submit">
            {locale === "ko" ? "검색" : "Search"}
          </button>
          <Link className="button-secondary" href={"/admin/workflows" as Route}>
            {locale === "ko" ? "초기화" : "Reset"}
          </Link>
        </div>
      </form>
      <p className="subtext">
        {locale === "ko"
          ? `${visibleCount.toLocaleString()} / ${totalCount.toLocaleString()}개 워크플로우 표시`
          : `${visibleCount.toLocaleString()} / ${totalCount.toLocaleString()} workflows shown`}
      </p>
    </section>
  );
}

function WorkflowList({ locale, workflows }: { locale: "en" | "ko"; workflows: WorkflowThreadSummary[] }) {
  if (workflows.length === 0) {
    return (
      <section className="empty-state">
        <h2>{locale === "ko" ? "검색 결과가 없습니다" : "No workflows found"}</h2>
        <p>
          {locale === "ko"
            ? "날짜, 파트너사명, 투어코드, 단체명 검색 조건을 조정해 주세요."
            : "Adjust the date, partner, tour code, or group name search filters."}
        </p>
      </section>
    );
  }

  return (
    <section className="workflow-list-shell" aria-label={locale === "ko" ? "워크플로우 커뮤니케이션 리스트" : "Workflow communication list"}>
      <div className="workflow-list-header" aria-hidden="true">
        <span>{locale === "ko" ? "날짜" : "Date"}</span>
        <span>{locale === "ko" ? "파트너사" : "Partner"}</span>
        <span>{locale === "ko" ? "투어코드" : "Tour code"}</span>
        <span>{locale === "ko" ? "단체명" : "Group name"}</span>
        <span>{locale === "ko" ? "상태" : "Status"}</span>
        <span>{locale === "ko" ? "열기" : "Open"}</span>
      </div>
      {workflows.map((workflow) => (
        <Link className="workflow-list-row" href={`/admin/workflows/${workflow.workflowCode}` as Route} key={workflow.id}>
          <span>
            <small>{locale === "ko" ? "날짜" : "Date"}</small>
            <strong>{formatDate(workflow.lastMessageAt ?? workflow.createdAt)}</strong>
          </span>
          <span>
            <small>{locale === "ko" ? "파트너사" : "Partner"}</small>
            <strong>{workflow.agencyName ?? (locale === "ko" ? "미연결" : "Not linked")}</strong>
          </span>
          <span>
            <small>{locale === "ko" ? "투어코드" : "Tour code"}</small>
            <strong>{workflow.workflowCode}</strong>
          </span>
          <span>
            <small>{locale === "ko" ? "단체명" : "Group name"}</small>
            <strong>{workflow.title}</strong>
          </span>
          <span>
            <small>{locale === "ko" ? "상태" : "Status"}</small>
            <em className={`status-dot status-${workflow.status}`}>{formatLabel(workflow.status)}</em>
          </span>
          <span className="workflow-list-open">{locale === "ko" ? "상세" : "Open"}</span>
        </Link>
      ))}
    </section>
  );
}

async function loadWorkflows(
  filters: WorkflowFilters,
  rawSearchParams: { page?: string; pageSize?: string }
): Promise<{ workflows: WorkflowThreadSummary[]; pagination: PaginationMeta; previewMode: boolean; error?: string }> {
  const searchParams = new URLSearchParams();
  if (rawSearchParams.page) searchParams.set("page", rawSearchParams.page);
  if (rawSearchParams.pageSize) searchParams.set("pageSize", rawSearchParams.pageSize);
  const pagination = parsePagination(searchParams);
  try {
    const { supabase } = await getInternalPageContext();
    const page = await listWorkflowThreadPage(supabase, { filters, pagination });
    return { workflows: page.items, pagination: page.pagination, previewMode: false };
  } catch (error) {
    const failure = classifyPageDataError(error);
    return {
      workflows: [],
      pagination: buildPaginationMeta(pagination, 0, 0),
      previewMode: false,
      error: failure.status === "auth-required" ? "An active internal session is required." : failure.message
    };
  }
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value: string) {
  const key = getWorkflowDateKey(value);
  if (key) return key;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

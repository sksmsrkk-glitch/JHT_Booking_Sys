import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import type { WorkflowThreadSummary } from "@/features/workflow/types";
import { getPageAuthorization } from "@/lib/api/page-session";
import { normalizeLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  partner?: string;
  tourCode?: string;
  group?: string;
}>;

type WorkflowFilters = {
  from?: string;
  to?: string;
  partner?: string;
  tourCode?: string;
  group?: string;
};

export default async function AdminWorkflowsPage({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("jht_locale")?.value);
  const filters = normalizeWorkflowFilters(await searchParams);
  const loadState = await loadWorkflows();
  const workflows = filterWorkflows(loadState.workflows, filters);

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

      <WorkflowFilterBar filters={filters} locale={locale} totalCount={loadState.workflows.length} visibleCount={workflows.length} />
      <WorkflowList locale={locale} workflows={workflows} />
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

async function loadWorkflows(): Promise<{ workflows: WorkflowThreadSummary[]; previewMode: boolean }> {
  const { headerStore, authorization } = await getPageAuthorization();
  const response = await fetch(buildInternalApiUrl("/api/workflows", headerStore), {
    headers: authorization ? { authorization } : {},
    cache: "no-store"
  });
  const payload = await response.json();
  return { workflows: payload.data ?? [], previewMode: Boolean(!authorization || payload.data?.[0]?.preview) };
}

function normalizeWorkflowFilters(params: Awaited<SearchParams>): WorkflowFilters {
  return {
    from: normalizeDate(params.from),
    to: normalizeDate(params.to),
    partner: normalizeOptional(params.partner),
    tourCode: normalizeOptional(params.tourCode),
    group: normalizeOptional(params.group)
  };
}

function filterWorkflows(workflows: WorkflowThreadSummary[], filters: WorkflowFilters) {
  return workflows.filter((workflow) => {
    const workflowDate = getDateKey(workflow.lastMessageAt ?? workflow.createdAt);
    if (filters.from && workflowDate && workflowDate < filters.from) return false;
    if (filters.to && workflowDate && workflowDate > filters.to) return false;
    if (filters.partner && !includesSearch(workflow.agencyName, filters.partner)) return false;
    if (filters.tourCode && !includesSearch(workflow.workflowCode, filters.tourCode)) return false;
    if (filters.group && !includesSearch(workflow.title, filters.group)) return false;
    return true;
  });
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value: string) {
  const key = getDateKey(value);
  if (key) return key;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getDateKey(value: string | null) {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDate(value: string | undefined) {
  const trimmed = normalizeOptional(value);
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function includesSearch(value: string | null | undefined, search: string) {
  return (value ?? "").toLowerCase().includes(search.toLowerCase());
}

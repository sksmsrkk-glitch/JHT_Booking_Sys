/**
 * @file 한글 책임: `workflow` 업무 기능의 입력 정규화, 상태 변환 또는 화면용 데이터를 구성합니다.
 * 여러 화면과 API가 같은 규칙을 재사용하도록 도메인 결정을 모으고, 공급사 원가와 파트너 공개 데이터의 경계를 유지합니다.
 */
import { normalizeDateRange } from "@/lib/domain/date-range.mjs";
import type { WorkflowThreadSummary } from "./types";

export type WorkflowFilters = {
  from?: string;
  to?: string;
  partner?: string;
  tourCode?: string;
  group?: string;
};

export type WorkflowFilterInput = {
  from?: string | null;
  to?: string | null;
  partner?: string | null;
  tourCode?: string | null;
  group?: string | null;
};

const workflowFilterKeys = ["from", "to", "partner", "tourCode", "group"] as const;

export function normalizeWorkflowFilters(input: WorkflowFilterInput): WorkflowFilters {
  // URL을 직접 고치는 등으로 시작일이 종료일보다 늦게 들어오면 두 값을 맞바꿔
  // 목록이 "결과 없음"으로 조용히 비어 보이는 상태를 막습니다.
  const { from, to } = normalizeDateRange(normalizeDate(input.from), normalizeDate(input.to));
  return {
    from,
    to,
    partner: normalizeOptional(input.partner),
    tourCode: normalizeOptional(input.tourCode),
    group: normalizeOptional(input.group)
  };
}

export function hasWorkflowFilters(filters: WorkflowFilters) {
  return workflowFilterKeys.some((key) => Boolean(filters[key]));
}

export function buildWorkflowSearchParams(filters: WorkflowFilters) {
  const params = new URLSearchParams();
  workflowFilterKeys.forEach((key) => {
    const value = filters[key];
    if (value) params.set(key, value);
  });
  return params;
}

export function filterWorkflowSummaries(workflows: WorkflowThreadSummary[], filters: WorkflowFilters) {
  if (!hasWorkflowFilters(filters)) return workflows;

  return workflows.filter((workflow) => {
    const workflowDate = getWorkflowDateKey(workflow.lastMessageAt ?? workflow.createdAt);

    if (filters.from && (!workflowDate || workflowDate < filters.from)) return false;
    if (filters.to && (!workflowDate || workflowDate > filters.to)) return false;
    if (filters.partner && !includesSearch(workflow.agencyName, filters.partner)) return false;
    if (filters.tourCode && !includesSearch(workflow.workflowCode, filters.tourCode)) return false;
    if (filters.group && !includesSearch(workflow.title, filters.group)) return false;

    return true;
  });
}

export function getWorkflowDateKey(value: string | null | undefined) {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function normalizeDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function includesSearch(value: string | null | undefined, search: string) {
  return normalizeSearchText(value).includes(normalizeSearchText(search));
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

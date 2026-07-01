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
  return {
    from: normalizeDate(input.from),
    to: normalizeDate(input.to),
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

/**
 * @file 한글 책임: `pagination` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
import { HttpError } from "./http";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PaginationInput = {
  page: number;
  pageSize: number;
};

export type PaginationMeta = PaginationInput & {
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
};

/**
 * 모든 목록 API가 같은 page/pageSize 규칙을 사용하도록 URL 파라미터를 정규화합니다.
 * 지나치게 큰 pageSize는 DB와 브라우저를 동시에 압박하므로 100건으로 제한합니다.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { pageSize?: number; maxPageSize?: number } = {}
): PaginationInput {
  const maxPageSize = defaults.maxPageSize ?? MAX_PAGE_SIZE;
  const fallbackPageSize = Math.min(defaults.pageSize ?? DEFAULT_PAGE_SIZE, maxPageSize);

  return {
    page: parsePositiveInteger(searchParams.get("page"), 1, "page"),
    pageSize: Math.min(parsePositiveInteger(searchParams.get("pageSize"), fallbackPageSize, "pageSize"), maxPageSize)
  };
}

export function paginationRange({ page, pageSize }: PaginationInput) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function buildPaginationMeta(
  input: PaginationInput,
  total: number | null | undefined,
  itemCount: number
): PaginationMeta {
  const normalizedTotal = Math.max(0, Number(total ?? itemCount));
  const totalPages = Math.max(1, Math.ceil(normalizedTotal / input.pageSize));

  return {
    ...input,
    total: normalizedTotal,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrevious: input.page > 1
  };
}

function parsePositiveInteger(value: string | null, fallback: number, field: string) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

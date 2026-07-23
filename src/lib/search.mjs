/**
 * @file 한글 책임: 목록 검색의 키워드 매칭 규칙을 한곳에 모은 순수 유틸입니다.
 * 여러 키워드를 공백으로 나눠 각 토큰을 AND로, 필드 사이는 OR로 결합해 어순·인접에 무관하게 찾고,
 * LIKE 와일드카드(%, _, \)를 이스케이프하며 PostgREST .or() 구문을 깨뜨리는 문자는 제거해 주입을 막습니다.
 */

const MAX_TOKENS = 6;
const MAX_TOKEN_LENGTH = 60;

/**
 * 검색어 하나(토큰)를 PostgREST .or() 값으로 안전하게 정규화합니다.
 *  - PostgREST 구문 문자( , ( ) * )는 공백으로 치환해 필터 파싱이 깨지지 않게 합니다.
 *  - LIKE 와일드카드( \ % _ )는 이스케이프해 리터럴로만 매칭합니다(오탐 방지).
 */
export function escapeSearchToken(token) {
  return String(token ?? "")
    .replace(/[(),*]/g, " ")
    .trim()
    .replace(/[\\%_]/g, (match) => `\\${match}`)
    .slice(0, MAX_TOKEN_LENGTH);
}

/**
 * 검색 입력을 토큰 목록으로 나눕니다. 공백 기준 분리, 빈 토큰 제거, 토큰 수 상한 적용.
 */
export function tokenizeSearch(value) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .map((token) => escapeSearchToken(token))
    .filter((token) => token.length > 0)
    .slice(0, MAX_TOKENS);
}

/**
 * 토큰별 PostgREST .or() 절 문자열 배열을 만듭니다.
 * 각 절은 "field1.ilike.%tok%,field2.ilike.%tok%" 형태이고, 절들을 각각 .or()로 체이닝하면
 * 토큰 사이가 AND(모든 토큰이 어딘가에는 있어야 함), 필드 사이가 OR가 됩니다.
 *
 * @param {string|null|undefined} value 사용자 검색 입력
 * @param {string[]} fields ilike 대상 컬럼 목록
 * @returns {string[]} .or()에 넣을 절 문자열 배열(검색어가 비면 빈 배열)
 */
export function buildSearchClauses(value, fields) {
  const tokens = tokenizeSearch(value);
  if (tokens.length === 0 || !Array.isArray(fields) || fields.length === 0) return [];
  return tokens.map((token) => fields.map((field) => `${field}.ilike.%${token}%`).join(","));
}

/**
 * Supabase 쿼리 빌더에 토큰-AND / 필드-OR 검색을 적용합니다.
 * 각 토큰 절을 개별 .or()로 체이닝(= AND)합니다.
 *
 * @template T
 * @param {T} query Supabase 쿼리 빌더(.or 지원)
 * @param {string|null|undefined} value 검색 입력
 * @param {string[]} fields ilike 대상 컬럼
 * @returns {T} 검색이 적용된 쿼리 빌더
 */
export function applySearch(query, value, fields) {
  let next = query;
  for (const clause of buildSearchClauses(value, fields)) {
    next = next.or(clause);
  }
  return next;
}

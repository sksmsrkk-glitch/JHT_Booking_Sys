/**
 * @file 한글 책임: `date range` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */

/** YYYY-MM-DD 형식이면서 실제로 존재하는 날짜인지 확인합니다. */
export function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * 시작일이 종료일보다 늦게 들어온 조회 구간을 교정합니다.
 * URL을 직접 고치거나 필드를 반대로 입력한 경우에도 목록 조회가 "결과 없음"으로
 * 조용히 죽지 않도록, 두 값을 맞바꿔 항상 시작≤종료인 구간을 돌려줍니다.
 * 한쪽만 있거나 형식이 잘못된 값은 그대로 통과시켜 호출자의 기존 규칙을 방해하지 않습니다.
 */
export function normalizeDateRange(from, to) {
  if (isIsoDate(from) && isIsoDate(to) && from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

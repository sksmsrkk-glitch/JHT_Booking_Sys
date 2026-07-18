/**
 * @file 한글 책임: `ids` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
export function makeCaseCode(prefix = "JHT") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function makeReservationCode(prefix = "RSV") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function makeInvoiceNo(prefix = "INV") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function makeShareId() {
  return `qc_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function makeExportPath(quoteVersionId: string) {
  return `quote-exports/${quoteVersionId}/${crypto.randomUUID()}.xlsx`;
}

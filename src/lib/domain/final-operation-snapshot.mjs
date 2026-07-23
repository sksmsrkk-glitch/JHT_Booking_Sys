/**
 * @file 한글 책임: 확정서(final operation snapshot)로 인보이스를 발행해도 되는지 판정하는 순수 검증 로직입니다.
 * 프론트엔드 검증과 별개로 서버가 동일 규칙을 재확인해, 플레이스홀더/빈 값이 그대로 청구서로 나가는 것을 막습니다.
 */

// 인보이스에 실려서는 안 되는 플레이스홀더 토큰들.
const PLACEHOLDER_TOKENS = ["tba", "tbd", "confirmed hotel name", "confirmed dinner menu"];

function isPlaceholder(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text.length === 0 || PLACEHOLDER_TOKENS.includes(text);
}

/**
 * 확정서 스냅샷이 인보이스 발행 가능한지 검사합니다.
 * 문제가 있으면 사용자에게 보여줄 사유 문자열을, 없으면 null을 반환합니다.
 *
 * @param {{ day_snapshots?: unknown, hotel_snapshot?: unknown, bank_account_snapshot?: unknown }} snapshot
 */
export function findFinalSnapshotIssueBlocker(snapshot) {
  const days = Array.isArray(snapshot?.day_snapshots) ? snapshot.day_snapshots : [];
  const bank =
    snapshot?.bank_account_snapshot && typeof snapshot.bank_account_snapshot === "object"
      ? snapshot.bank_account_snapshot
      : {};

  const hasRealDay = days.some((day) => {
    const date = String(day?.date ?? "").trim();
    return date.length > 0 && !isPlaceholder(day?.hotel);
  });
  if (!hasRealDay) {
    return "A confirmed date and hotel are required on at least one day before invoice issuance.";
  }

  for (const day of days) {
    const date = String(day?.date ?? "").trim();
    if (date.length > 0 && isPlaceholder(day?.hotel)) {
      return `Day ${day?.day ?? "?"} still has a placeholder hotel name.`;
    }
  }

  if (!String(bank.payableTo ?? "").trim() || !String(bank.bankName ?? "").trim()) {
    return "Bank payable-to and bank name are required before invoice issuance.";
  }
  if (isPlaceholder(bank.accountNo)) {
    return "A real bank account number is required (placeholder 'TBA' is not allowed).";
  }

  return null;
}

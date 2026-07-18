/**
 * @file 한글 책임: `reservations` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
/**
 * 예약 상태 전이 도메인 규칙입니다.
 *
 * 예약 확정/취소는 고위험 액션이므로, 아무 상태로나 점프하지 못하게
 * 허용 전이 맵으로 제한하고, 확정/취소에는 사유와 감사 위험도를 강제합니다.
 * 라우트는 이 순수 함수로 전이를 검증한 뒤 update_reservation_status RPC를 호출합니다.
 */
export const RESERVATION_STATUSES = [
  "pending",
  "requested",
  "confirmed",
  "on_tour",
  "completed",
  "cancelled"
];

// 고위험 상태(승인/감사 대상): 확정과 취소.
export const HIGH_RISK_RESERVATION_STATUSES = ["confirmed", "cancelled"];

const RESERVATION_TRANSITIONS = {
  pending: ["requested", "confirmed", "cancelled"],
  requested: ["confirmed", "cancelled"],
  confirmed: ["on_tour", "completed", "cancelled"],
  on_tour: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

/**
 * 예약 상태 전이를 검증하고 감사 위험도/사유 요건을 반환합니다.
 *
 * @param {{ currentStatus: string, nextStatus: string, reason?: string|null }} input
 * @returns {{ nextStatus: string, isHighRisk: boolean, riskLevel: "normal"|"high", reason: string|null }}
 */
export function planReservationStatusChange({ currentStatus, nextStatus, reason = null }) {
  if (!RESERVATION_STATUSES.includes(currentStatus)) {
    throw new Error(`Unsupported current reservation status: ${currentStatus}`);
  }
  if (!RESERVATION_STATUSES.includes(nextStatus)) {
    throw new Error(`Unsupported reservation status: ${nextStatus}`);
  }
  if (currentStatus === nextStatus) {
    throw new Error(`Reservation is already ${currentStatus}`);
  }

  const allowed = RESERVATION_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Reservation cannot move from ${currentStatus} to ${nextStatus}`);
  }

  const isHighRisk = HIGH_RISK_RESERVATION_STATUSES.includes(nextStatus);
  const normalizedReason = typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : null;
  if (isHighRisk && !normalizedReason) {
    throw new Error(`A reason is required to move a reservation to ${nextStatus}`);
  }

  return {
    nextStatus,
    isHighRisk,
    riskLevel: isHighRisk ? "high" : "normal",
    reason: normalizedReason
  };
}

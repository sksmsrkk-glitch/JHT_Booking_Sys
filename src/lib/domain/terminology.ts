/**
 * @file 한글 책임: `terminology` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
export const BUSINESS_TERMS = {
  overseasAgency: {
    tablePrefix: "agency",
    label: "Overseas Agency",
    description:
      "Foreign travel agency customer that requests quotes, sells locally, sends passengers, and pays JHT."
  },
  domesticSupplier: {
    tablePrefix: "domestic_supplier",
    label: "Domestic Supplier",
    description:
      "Korea-side supplier that provides hotels, vehicles, restaurants, attractions, guides, and other costs."
  }
} as const;

export const PROHIBITED_GENERIC_TERMS = ["partner_account", "partner_user", "partner_price"];

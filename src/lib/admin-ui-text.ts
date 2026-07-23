/**
 * @file 한글 책임: 내부 관리자 화면의 영문 UI 라벨을 한국어로 매핑하는 서버측 사전과 조회 헬퍼입니다.
 * 예전에는 GlobalTextTranslator가 하이드레이션 이후 DOM 텍스트를 직접 바꿔 불일치·깜빡임을 유발했는데,
 * 이 사전을 서버 렌더 시점에 적용해 그 문제를 없앱니다. 파트너 포털은 영어 전용이라 이 사전을 쓰지 않습니다.
 */
import type { Locale } from "@/lib/i18n";

const adminUiTextKo: Record<string, string> = {
  "Back to Admin": "관리자 홈",
  "Back to Quotes": "견적 목록",
  "Back to Reservations": "예약 목록",
  "Search Costs": "원가 검색",
  "Open Quotes": "견적 열기",
  "Open Tasks": "업무 열기",
  Workflows: "업무 흐름",
  Confirmations: "확정서",
  "Guide Expenses": "가이드 지출",
  Users: "사용자",
  "Account Recovery": "계정 복구",
  Audit: "감사",
  Companies: "회사 관리",
  "Domestic Suppliers": "국내 공급사",
  "Quote Cases": "견적 관리",
  Quotes: "견적",
  Reservations: "예약",
  "Overseas Agency Portal": "해외 파트너 포털",
  "Overseas Agencies": "해외 파트너사",
  "Cost Search": "원가 검색",
  "Exchange Rates": "환율 관리",
  "Operation Tasks": "오퍼레이션 업무",
  "Supplier Messages": "공급사 메시지",
  Finance: "회계/정산",
  Invoices: "인보이스",
  Settlements: "정산",
  "Audit Log": "감사 로그",
  "API Logs": "API 로그",
  "Internal Users": "내부 사용자",
  "Support Tools": "지원 도구",
  "Operations Dashboard": "운영 대시보드",
  "Dynamic Board": "동적 보드",
  Country: "국가",
  Partner: "파트너사",
  Period: "기간",
  Status: "상태",
  Overview: "전체",
  "Overview Table": "전체 보기",
  "Country View": "국가별 보기",
  "Partner View": "파트너사별 보기",
  "Period View": "기간별 보기",
  "Status View": "상태별 보기",
  "All countries": "전체 국가",
  "All partners": "전체 파트너사",
  "All statuses": "전체 상태",
  From: "시작일",
  To: "종료일",
  Filter: "필터",
  "Partner quote inquiries": "파트너 견적 문의",
  "Confirmed groups": "확정 단체",
  "Cancelled groups": "취소 단체",
  "All inquiries": "전체 문의",
  "Quote cases": "견적 건",
  "Total pax": "총 인원",
  "Settlement done": "정산 완료",
  "Receivable groups": "미수 단체",
  "Receivable amount": "미수 금액",
  "Quote inquiries": "견적 문의",
  Confirmed: "확정",
  Cancelled: "취소",
  Receivable: "미수금",
  "Top Countries": "주요 국가",
  "Top Partners": "주요 파트너사",
  "By Status": "상태별"
};

/**
 * 관리자 UI 라벨을 로캘에 맞게 반환합니다. ko가 아니거나 사전에 없으면 원문(영문)을 그대로 돌려줍니다.
 */
export function translateAdminUi(locale: Locale, text: string): string {
  if (locale !== "ko") return text;
  return adminUiTextKo[text] ?? text;
}

export function hasAdminUiTranslation(text: string): boolean {
  return text in adminUiTextKo;
}

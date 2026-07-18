/**
 * @file 한글 책임: `i18n` 모듈이 담당하는 공통 애플리케이션 규칙과 재사용 가능한 계약을 정의합니다.
 * 호출 계층이 내부 구현에 직접 의존하지 않도록 입력·출력과 오류 경계를 명확히 유지합니다.
 */
export type Locale = "en" | "ko";

export const defaultLocale: Locale = "en";

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "ko" ? "ko" : "en";
}

export const commonText = {
  en: {
    brand: "JHT Operations",
    internalAdmin: "Internal Admin",
    domesticSuppliers: "Domestic Suppliers",
    quotes: "Quotes",
    reservations: "Reservations",
    overseasAgencyPortal: "Overseas Agency Portal",
    exchangeRates: "Exchange Rates",
    signIn: "Log In",
    signOut: "Log Out",
    language: "Language",
    english: "English",
    korean: "Korean",
    owner: "Owner",
    live: "Live",
    ready: "Ready",
    next: "Next"
  },
  ko: {
    brand: "정호여행사 운영",
    internalAdmin: "내부 관리자",
    domesticSuppliers: "국내 공급사",
    quotes: "견적",
    reservations: "예약",
    overseasAgencyPortal: "해외 파트너 포털",
    exchangeRates: "환율 관리",
    signIn: "로그인",
    signOut: "로그아웃",
    language: "언어",
    english: "영문",
    korean: "한글",
    owner: "담당",
    live: "운영중",
    ready: "준비됨",
    next: "예정"
  }
} as const;

export const routeText: Record<
  string,
  {
    ko: {
      title: string;
      description: string;
      owner: string;
    };
  }
> = {
  Companies: {
    ko: {
      title: "회사 관리",
      description: "파트너, 공급사, 견적, 내부 사용자에 연결되는 운영 회사 정보입니다.",
      owner: "관리자"
    }
  },
  "Domestic Suppliers": {
    ko: {
      title: "국내 공급사",
      description: "호텔, 차량, 식당, 관광지, 가이드 등 국내 원가 마스터 데이터입니다.",
      owner: "오퍼레이션"
    }
  },
  "Overseas Agencies": {
    ko: {
      title: "해외 파트너사",
      description: "해외 여행사 계정, 담당자, 포털 사용자 관리입니다.",
      owner: "세일즈"
    }
  },
  "Cost Search": {
    ko: {
      title: "원가 검색",
      description: "견적 작성 전 공급사 상품과 가격을 검색하고 원가 스냅샷을 확인합니다.",
      owner: "세일즈 운영"
    }
  },
  "Exchange Rates": {
    ko: {
      title: "환율 관리",
      description: "견적, 원가 스냅샷, 인보이스, 정산에서 사용하는 원화 환율 마스터입니다.",
      owner: "회계"
    }
  },
  "Quote Cases": {
    ko: {
      title: "견적 관리",
      description: "견적 건, 버전, 일정, 이동 구간, 견적서 출력을 관리합니다.",
      owner: "세일즈"
    }
  },
  Reservations: {
    ko: {
      title: "예약 관리",
      description: "확정 견적 이후 예약 상태, 룸링 리스트, 진행 이력을 관리합니다.",
      owner: "오퍼레이션"
    }
  },
  "Operation Tasks": {
    ko: {
      title: "오퍼레이션 업무",
      description: "팀별 업무, 리마인더, 지연, 차단 상태를 관리합니다.",
      owner: "오퍼레이션"
    }
  },
  "Supplier Messages": {
    ko: {
      title: "공급사 메시지",
      description: "이메일/카카오 발송 초안, 승인, 재발송을 관리합니다.",
      owner: "예약팀"
    }
  },
  Finance: {
    ko: {
      title: "회계/정산",
      description: "인보이스, 입금, 비용, 쇼핑 커미션, 정산을 관리합니다.",
      owner: "회계"
    }
  },
  "Gmail Review": {
    ko: {
      title: "Gmail 검토",
      description: "자동 매칭 신뢰도가 낮은 Gmail 스레드를 수동 검토합니다.",
      owner: "세일즈 운영"
    }
  },
  "Failed Jobs": {
    ko: {
      title: "실패 작업",
      description: "공급사 발송 실패와 견적 XLSX 출력 실패 작업을 복구합니다.",
      owner: "오퍼레이션"
    }
  },
  "Notion CSV Migration": {
    ko: {
      title: "Notion CSV 이관",
      description: "검증과 승인 후 Notion CSV 데이터를 단계적으로 이관합니다.",
      owner: "관리자"
    }
  },
  "Audit Log": {
    ko: {
      title: "감사 로그",
      description: "승인, 상태 변경, 자동화 작업의 중요 이력을 확인합니다.",
      owner: "관리자"
    }
  },
  "API Logs": {
    ko: {
      title: "API 로그",
      description: "운영 API, 웹훅, 자동화 호출 이력을 확인합니다.",
      owner: "관리자"
    }
  },
  "V1 Readiness": {
    ko: {
      title: "V1 준비 상태",
      description: "실제 DB와 도메인 연결 전 환경 변수와 워크플로우 게이트를 확인합니다.",
      owner: "관리자"
    }
  },
  "Internal Users": {
    ko: {
      title: "내부 사용자",
      description: "관리자, 회계, 세일즈, 오퍼레이션 역할을 등록하고 관리합니다.",
      owner: "관리자"
    }
  },
  Inquiries: {
    ko: {
      title: "문의",
      description: "신규 문의, 재견적 요청, 예약 요청을 생성하고 추적합니다.",
      owner: "파트너 사용자"
    }
  },
  "New Inquiry": {
    ko: {
      title: "신규 문의",
      description: "파트너 사용자가 새 견적 문의를 입력하는 화면입니다.",
      owner: "파트너 사용자"
    }
  },
  Quotes: {
    ko: {
      title: "견적",
      description: "공개 견적 버전을 확인합니다. 원가와 마진은 노출되지 않습니다.",
      owner: "파트너 사용자"
    }
  },
  Invoices: {
    ko: {
      title: "인보이스",
      description: "발행된 인보이스와 안전한 결제 요약을 확인합니다.",
      owner: "파트너 사용자"
    }
  }
};

/**
 * @file 한글 책임: `countries` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type CountryReference = {
  countryCode: string;
  countryName: string;
  defaultCurrency: string | null;
  aliases: string[];
  source: string;
  status: string;
  createdAt: string | null;
};

export type CountryReferenceFilters = {
  q?: string;
  status?: string;
};

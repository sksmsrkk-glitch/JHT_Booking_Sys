/**
 * @file 한글 책임: `costing` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type CostSearchSupplier = {
  id: string;
  category: string;
  name_ko: string;
  name_en: string | null;
  region_level1: string | null;
  region_level2: string | null;
  google_place_id: string | null;
  naver_map_url: string | null;
  status: string;
};

export type CostSearchPrice = {
  id: string;
  pricing_unit: string;
  currency: string;
  cost_amount: number;
  min_pax: number | null;
  max_pax: number | null;
  season_label: string | null;
  valid_from: string | null;
  valid_to: string | null;
  weekday_rule: string | null;
  includes_tax: boolean;
  status: string;
};

export type CostSearchItem = {
  id: string;
  domestic_supplier_id: string;
  product_type: string;
  name_ko: string;
  name_en: string | null;
  search_name: string;
  description: string | null;
  capacity: number | null;
  room_type: string | null;
  breakfast_included: boolean | null;
  vehicle_seat_count: number | null;
  menu_tags: string[] | null;
  domestic_suppliers: CostSearchSupplier;
  supplier_prices: CostSearchPrice[];
};

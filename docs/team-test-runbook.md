# JHT Booking System 팀 테스트 런북

이 문서는 정호여행사 내부 팀원이 개발/검수 단계의 JHT Booking System을 직접 접속해서 테스트하고, Notion에서 내려받은 CSV 데이터를 Supabase DB로 단계적으로 넣어 보는 절차를 설명합니다.

> 주의: 이 문서의 외부 공개 방식은 팀 테스트용 임시 공개입니다. 실제 고객 정보, 여권 정보, 카드 정보, 실계좌 정보, 운영 비밀번호는 입력하지 않습니다.

## 1. 접속 방식

### 1.1 같은 사무실 또는 같은 Wi-Fi에서 접속

개발 PC에서 서버를 아래처럼 실행합니다.

```powershell
npm run dev:team
```

현재 PC의 내부 IP를 확인합니다.

```powershell
ipconfig
```

팀원에게 아래 형식으로 공유합니다.

```text
내부 관리자: http://<개발PC-IP>:3100/admin
파트너 포털: http://<개발PC-IP>:3100/agency
```

예시:

```text
내부 관리자: http://192.168.0.39:3100/admin
파트너 포털: http://192.168.0.39:3100/agency
```

### 1.2 외부 인터넷에서 임시 접속

Cloudflare Tunnel을 사용하면 공유기 포트포워딩 없이 임시 HTTPS URL을 만들 수 있습니다.

1. 개발 서버를 켭니다.

```powershell
npm run dev:team
```

2. 다른 터미널에서 터널을 실행합니다.

```powershell
npm run tunnel:cloudflare
```

3. 터미널에 표시되는 `https://xxxx.trycloudflare.com` 주소를 팀원에게 공유합니다.

공유 URL 형식:

```text
내부 관리자: https://xxxx.trycloudflare.com/admin
파트너 포털: https://xxxx.trycloudflare.com/agency
파트너 신규 문의: https://xxxx.trycloudflare.com/agency/inquiries/new
파트너 소통 원장: https://xxxx.trycloudflare.com/agency/workflows
```

4. 테스트가 끝나면 Cloudflare Tunnel 터미널에서 `Ctrl + C`를 눌러 외부 접속을 닫습니다.

## 2. 테스트 전 준비 체크리스트

| 상태 | 확인 항목 | 기준 |
|---|---|---|
| [ ] | 개발 서버 실행 | `npm run dev:team` 실행 후 `/admin` 접속 가능 |
| [ ] | 외부 URL 생성 | `npm run tunnel:cloudflare` 실행 후 `trycloudflare.com` URL 확인 |
| [ ] | 내부 관리자 접속 | `/admin` 화면이 정상 표시 |
| [ ] | 파트너 포털 접속 | `/agency` 화면이 정상 표시 |
| [ ] | 언어 전환 | EN/KOR 버튼이 동작 |
| [ ] | 다크 모드 | Dark 버튼이 동작 |
| [ ] | 캘린더 영문 표시 | 파트너 문의 화면 날짜 입력이 `YYYY-MM-DD`, `Sun/Mon/...`로 표시 |
| [ ] | Supabase 연결 | 실제 Supabase URL/anon key/service role key가 `.env.local`에 설정 |
| [ ] | 데모 데이터 구분 | 테스트 데이터와 실제 운영 데이터를 혼동하지 않도록 source name에 날짜 포함 |

## 3. 내부 관리자 테스트 체크리스트

### 3.1 Dashboard

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin` 접속 | Operation Admin 대시보드 표시 |
| [ ] | 상단 메뉴 클릭 | Dashboard, Quotes, Reservations, Finance 이동 |
| [ ] | More 메뉴 열기/닫기 | 다른 영역 클릭 시 메뉴 닫힘 |
| [ ] | 대시보드 카드 클릭 | 관련 페이지가 있는 카드는 해당 페이지로 이동 |

### 3.2 Country / Exchange Rate

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin/exchange-rates` 접속 | 국가 공통 마스터와 환율 등록 영역 표시 |
| [ ] | 국가 선택 | Country Code, Country Name, Default Currency가 공통 마스터 기준으로 연결 |
| [ ] | 환율 등록 | 기준 통화, 상대 통화, KRW 환산율, 적용일 저장 가능 |
| [ ] | 견적 화면 확인 | 견적의 국가/통화 선택이 공통 관리 값과 연결 |

### 3.3 Domestic Suppliers

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin/domestic-suppliers` 접속 | 호텔, 차량, 식당, 관광지, 가이드, 기타 비용 관리 가능 |
| [ ] | 식당 메뉴 추가 | 한 식당에 여러 메뉴와 메뉴별 가격 등록 가능 |
| [ ] | 관광지 티켓 추가 | 한 관광지에 여러 티켓과 성인/아동 가격 등록 가능 |
| [ ] | 이미지 추가 | 항목별 최대 10장 이미지 설계 확인 |
| [ ] | Excel 템플릿/출력 | 공급사 원가 데이터 템플릿 및 export 동작 확인 |

### 3.4 Quotes

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin/quote-cases` 접속 | 엑셀 견적서 구조의 Quote Items와 Itinerary Days 표시 |
| [ ] | 공급사 키워드 검색 | 호텔, 차량, 식사, 관광지 등 아이템 검색 가능 |
| [ ] | 자동 계산 | 수량, PAX, 환율, 마진 계산 반영 |
| [ ] | 수동 수정 | 자동 계산값을 수동 override 가능 |
| [ ] | 파트너 견적서 | 공개용 견적서에 일정, description, terms & conditions 포함 |

### 3.5 Reservations

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin/reservations` 접속 | Google Calendar 스타일 월간 단체 현황표 표시 |
| [ ] | 연도/월 검색 | 원하는 연도와 월로 캘린더 조회 |
| [ ] | 빨간 bar 확인 | 호텔/차량/가이드 등 미완료 항목이 있으면 미완료 상태 표시 |
| [ ] | 단체 bar 클릭 | 예약 상세 또는 운영 체크리스트로 이동 |
| [ ] | Incomplete Groups | 미완료 단체를 리스트 형태로 확인 |

### 3.6 Confirmations / Invoice / Finance

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin/confirmations` 접속 | 최종 확정서 리스트와 status 대시보드 표시 |
| [ ] | 확정서 열기 | 최종 호텔, 룸타입, 식사, 일정, 특이사항 입력 가능 |
| [ ] | 인보이스 자동 생성 | 최종 견적서 + 최종 운영 정보를 기반으로 인보이스 생성 가능 |
| [ ] | 인보이스 Excel 다운로드 | 인보이스 화면에서 XLSX 다운로드 가능 |
| [ ] | 미수금/정산 상태 | Finance dashboard에 정산완료, 미수금 상태 반영 |

### 3.7 Guide Expenses

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin/guide-expenses` 접속 | 가이드 지출결의서 리스트 표시 |
| [ ] | 리포트 열기 | report no가 workflow code와 연결 |
| [ ] | 실제 비용 입력 | 숙박비, 식음료비, 입장료, 기타 현금, 가이드 비용 입력 가능 |
| [ ] | 인보이스 비교 | 인보이스 최종 금액과 실제 비용 비교 가능 |

### 3.8 Partner Communication Workflow

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/admin/workflows` 접속 | workflow code별 커뮤니케이션 원장 리스트 표시 |
| [ ] | 날짜/파트너/투어코드/단체명 검색 | 필터가 함께 동작 |
| [ ] | 원장 상세 열기 | 파트너 메시지, 내부 메모, action item 확인 |
| [ ] | 작성자 확인 | 내부 직원은 profile, 파트너는 agency user와 연결 |
| [ ] | 공개 범위 확인 | Partner visible과 Internal only 구분 |

## 4. 파트너 포털 테스트 체크리스트

| 상태 | 테스트 | 기대 결과 |
|---|---|---|
| [ ] | `/agency` 접속 | 파트너 전용 workspace 표시 |
| [ ] | `/agency/signup` 접속 | 가입 신청 화면 표시 |
| [ ] | 국가 선택 | 국가/기본 통화가 공통 마스터 dropdown에서 선택 |
| [ ] | `/agency/inquiries/new` 접속 | 신규 견적 문의 입력 가능 |
| [ ] | 날짜 입력 | 캘린더가 영문 기준으로 표시 |
| [ ] | 신규 문의 필수값 | Tour Title, Number of Pax, Period, Nights in Korea 입력 |
| [ ] | 항공편 정보 | Arrival/Departure flight no, route, time 입력 |
| [ ] | `/agency/quote-cases` 접속 | 파트너 공개 견적 리스트 표시 |
| [ ] | `/agency/workflows` 접속 | 해당 workflow code의 소통 내역 확인 |
| [ ] | `/agency/invoices` 접속 | 발행된 인보이스 확인 |

## 5. Notion CSV 데이터를 Supabase로 넣는 절차

### 5.1 전체 원칙

Notion 데이터는 운영 테이블에 바로 넣지 않습니다. 항상 아래 순서로 처리합니다.

```text
Notion CSV export
→ CSV 정리
→ Supabase import용 JSON rows 생성
→ /admin/migrations/notion-csv 에 staging
→ Validate
→ Approve
→ Import
→ /admin/domestic-suppliers 또는 관련 화면에서 검수
```

이렇게 하는 이유:

- 잘못된 컬럼명이나 누락값을 먼저 잡기 위해서
- Domestic Supplier와 Overseas Agency가 섞이지 않게 하기 위해서
- import 전 승인 이력을 남기기 위해서
- 나중에 어떤 파일에서 어떤 데이터가 들어왔는지 추적하기 위해서

### 5.2 Notion에서 CSV 내려받기

1. Notion에서 가져올 데이터베이스를 엽니다.
2. 우측 상단 `...` 메뉴를 클릭합니다.
3. `Export`를 클릭합니다.
4. `CSV` 형식으로 내려받습니다.
5. 파일명에 데이터 종류와 날짜를 넣습니다.

예시:

```text
notion-attractions-2026-07-07.csv
notion-restaurants-2026-07-07.csv
notion-vehicles-2026-07-07.csv
notion-hotels-2026-07-07.csv
```

이미지, 본문 설명, 첨부 파일까지 포함된 Notion page export라면 `Markdown & CSV` 또는 ZIP export를 내려받고 `npm run convert:notion-md` 변환기를 사용합니다.

### 5.3 import 대상 테이블 순서

공급사 원가 마스터는 부모/자식 관계가 있으므로 순서가 중요합니다.

| 순서 | Target Table | 용도 | 먼저 필요한 값 |
|---:|---|---|---|
| 1 | `domestic_suppliers` | 호텔, 차량사, 식당, 관광지, 가이드, 기타 공급사 기본 정보 | `company_id` |
| 2 | `supplier_contacts` | 공급사 담당자 연락처 | `domestic_supplier_id` |
| 3 | `supplier_products` | 메뉴, 티켓, 차량 구간, 객실 타입, 가이드 서비스 | `domestic_supplier_id` |
| 4 | `supplier_prices` | 상품별 가격, 기간, 통화, 단가 | `supplier_product_id` |
| 5 | `supplier_media` | 이미지/영상 storage path | `storage_path` |

### 5.4 필수 필드

| Target Table | 필수 필드 |
|---|---|
| `agency_accounts` | `name` |
| `agency_contacts` | `agency_account_id`, `name` |
| `domestic_suppliers` | `company_id`, `category`, `name_ko` |
| `supplier_contacts` | `domestic_supplier_id`, `name` |
| `supplier_products` | `domestic_supplier_id`, `product_type`, `name_ko`, `search_name` |
| `supplier_prices` | `supplier_product_id`, `pricing_unit`, `currency`, `cost_amount` |
| `supplier_media` | `media_type`, `storage_path` |

### 5.5 카테고리 표준값

| 업무 항목 | `category` 예시 | `product_type` 예시 |
|---|---|---|
| 호텔 | `hotel` | `room`, `breakfast`, `banquet_room`, `facility` |
| 차량 | `vehicle` | `coach`, `van`, `transfer`, `extra_hour` |
| 식당 | `restaurant` | `menu`, `meal_plan` |
| 관광지 | `attraction` | `ticket`, `experience`, `performance` |
| 가이드 | `guide` | `guide_service` |
| 기타 | `other` | `ktx`, `luggage_truck`, `flight_ticket` |
| 인센티브 연회장 | `incentive_banquet` | `banquet_menu`, `facility` |

### 5.6 JSON rows 예시

#### 관광지 기본 정보: `domestic_suppliers`

```json
[
  {
    "company_id": "JHT_COMPANY_UUID",
    "category": "attraction",
    "name_ko": "경복궁",
    "name_en": "Gyeongbokgung Palace",
    "region_level1": "Seoul",
    "region_level2": "Jongno",
    "address": "161 Sajik-ro, Jongno-gu, Seoul",
    "status": "active",
    "metadata": {
      "operationHours": "09:00-18:00",
      "tags": ["history", "palace"]
    }
  }
]
```

#### 관광지 티켓 상품: `supplier_products`

```json
[
  {
    "domestic_supplier_id": "SUPPLIER_UUID",
    "product_type": "ticket",
    "name_ko": "성인 입장권",
    "name_en": "Adult Ticket",
    "search_name": "경복궁 성인 입장권 palace adult ticket",
    "status": "active",
    "metadata": {
      "ageType": "adult"
    }
  }
]
```

#### 티켓 가격: `supplier_prices`

```json
[
  {
    "supplier_product_id": "PRODUCT_UUID",
    "pricing_unit": "per_person",
    "currency": "KRW",
    "cost_amount": 3000,
    "status": "active",
    "metadata": {
      "source": "notion-attractions-2026-07-07"
    }
  }
]
```

#### 식당 메뉴 상품: `supplier_products`

```json
[
  {
    "domestic_supplier_id": "RESTAURANT_SUPPLIER_UUID",
    "product_type": "menu",
    "name_ko": "불고기 정식",
    "name_en": "Bulgogi Set",
    "search_name": "불고기 정식 bulgogi set Korean meal non halal",
    "status": "active",
    "metadata": {
      "dietaryTags": ["non_halal"],
      "capacity": 80
    }
  }
]
```

### 5.7 관리자 화면에서 staging하는 방법

1. 관리자 페이지를 엽니다.

```text
/admin/migrations/notion-csv
```

2. `Source Name`에 원본 파일명을 입력합니다.

```text
notion-restaurants-2026-07-07
```

3. `Target Table`을 선택합니다.

```text
domestic_suppliers
```

4. `Rows JSON`에 JSON array를 붙여 넣습니다.
5. `Stage Rows`를 클릭합니다.
6. 생성된 batch에서 `Validate`를 클릭합니다.
7. 오류가 있으면 JSON을 수정해서 다시 staging합니다.
8. 오류가 0개이면 `Approve`를 클릭합니다.
9. 마지막으로 `Import`를 클릭합니다.
10. `/admin/domestic-suppliers`에서 검색이 되는지 확인합니다.
11. `/admin/quote-cases`의 Quote Items 검색에서 키워드로 불러오는지 확인합니다.

### 5.8 Markdown ZIP 변환기 사용

Notion에서 이미지/본문 포함 ZIP을 내려받은 경우:

```powershell
npm run convert:notion-md -- "C:\Users\Issac\Downloads\notion-export.zip" --out tmp/notion-md-import --company-id "JHT_COMPANY_UUID"
```

생성 파일:

| 파일 | 용도 |
|---|---|
| `notion-md-supabase-import-plan.json` | 전체 변환 계획 |
| `staging-domestic-suppliers.json` | 관리자 migration 화면에 붙일 공급사 rows |
| `supplier-products-relationship-rows.json` | supplier UUID 연결 후 사용할 상품 rows |
| `supplier-prices-relationship-rows.json` | product UUID 연결 후 사용할 가격 rows |
| `supplier-media-relationship-rows.json` | Storage 업로드 후 사용할 이미지 rows |
| `manifest.json` | 변환 결과 요약과 경고 |

### 5.9 import 후 검수 체크리스트

| 상태 | 확인 항목 |
|---|---|
| [ ] | `Validate` 오류가 0개인지 확인 |
| [ ] | `Approve`와 `Import`가 순서대로 실행됐는지 확인 |
| [ ] | `/admin/domestic-suppliers`에서 공급사명이 검색되는지 확인 |
| [ ] | 상품/메뉴/티켓이 공급사 상세에 연결됐는지 확인 |
| [ ] | 가격 통화와 금액이 정확한지 확인 |
| [ ] | 이미지가 있다면 Storage path 또는 URL이 연결됐는지 확인 |
| [ ] | `/admin/quote-cases`에서 키워드로 아이템 검색이 되는지 확인 |
| [ ] | 잘못 들어간 테스트 batch는 운영 import 전에 별도 삭제 또는 inactive 처리 |

## 6. 팀원 테스트 결과 기록 양식

테스트 중 발견한 이슈는 아래 형식으로 기록합니다.

```text
테스트 일시:
테스터:
접속 URL:
테스트 페이지:
재현 절차:
기대 결과:
실제 결과:
첨부 이미지:
중요도: 높음 / 보통 / 낮음
비고:
```

## 7. 테스트 종료 절차

1. 팀원이 테스트를 끝냈는지 확인합니다.
2. Cloudflare Tunnel 터미널에서 `Ctrl + C`를 눌러 외부 접속을 종료합니다.
3. 개발 서버 터미널도 필요 없으면 `Ctrl + C`로 종료합니다.
4. 테스트 중 입력한 불필요한 demo 데이터는 Supabase에서 삭제하거나 inactive 처리합니다.
5. 발견 이슈를 GitHub issue 또는 작업 문서에 정리합니다.


# Notion Markdown / CSV Export 변환기

Notion에서 단순 CSV가 아니라 이미지, 본문 설명, 첨부 파일을 포함한 ZIP export를 내려받은 경우에는 `/admin/migrations/notion-csv`에 바로 붙여 넣을 수 없습니다. 먼저 Supabase import용 JSON rows로 변환한 뒤, 관리자 migration 화면에서 staging, validation, approval, import 순서로 처리합니다.

## 1. 언제 이 변환기를 쓰나

아래 데이터는 변환기를 사용하는 것이 좋습니다.

- 관광지 설명과 이미지가 포함된 Notion page export
- 식당 메뉴 이미지, 메뉴 설명, dietary tag가 포함된 export
- 호텔 이미지, 객실 설명, 연회장 정보가 포함된 export
- 차량 이미지, 차량 종류, 구간 요금 설명이 포함된 export
- CSV 컬럼만으로는 구조화하기 어려운 본문형 Notion 데이터

단순 테이블 CSV만 있다면 `docs/team-test-runbook.md`의 Notion CSV 절차에 따라 JSON rows를 직접 만들어 staging할 수 있습니다.

## 2. 실행 명령

기본 실행:

```powershell
npm run convert:notion-md -- "C:\Users\Issac\Downloads\notion-export.zip" --out tmp/notion-md-import
```

실제 운영 테이블에 넣을 supplier rows까지 만들려면 JHT company UUID를 함께 지정합니다.

```powershell
npm run convert:notion-md -- "C:\Users\Issac\Downloads\notion-export.zip" --out tmp/notion-md-import --company-id "JHT_COMPANY_UUID"
```

## 3. 출력 파일

| 파일 | 용도 |
|---|---|
| `notion-md-supabase-import-plan.json` | 공급사, 상품, 가격, 미디어를 관계 키로 묶은 전체 변환 결과 |
| `staging-domestic-suppliers.json` | `/admin/migrations/notion-csv`에 붙여 넣을 공급사 rows |
| `supplier-products-relationship-rows.json` | 공급사 import 후 생성된 UUID를 연결해서 사용할 상품 rows |
| `supplier-prices-relationship-rows.json` | 상품 import 후 생성된 UUID를 연결해서 사용할 가격 rows |
| `supplier-media-relationship-rows.json` | 이미지 Storage 업로드 후 사용할 media rows |
| `manifest.json` | 변환 요약, 경고, 누락 가능성 기록 |

## 4. Notion 속성 매핑 기준

| Notion 속성 또는 본문 정보 | Supabase 대상 |
|---|---|
| 페이지 제목 | `domestic_suppliers.name_ko` 또는 `supplier_products.name_ko` |
| 영문명 | `name_en` |
| 지역, 광역 지역명 | `region_level1`, `region_level2` |
| 주소 | `domestic_suppliers.address` |
| 공급사 구분, 콘텐츠 유형 | `category`, `product_type`, `search_keywords` |
| 상품 목록, 메뉴, 티켓명 | `supplier_products` |
| 가격, 관람료, 메뉴가 | `supplier_prices.cost_amount` |
| 이미지, 영상, 첨부 파일 | `supplier_media.storage_path` 또는 외부 URL metadata |

## 5. 변환 후 import 순서

1. 변환기를 실행합니다.
2. `manifest.json`에서 경고와 누락값을 확인합니다.
3. `staging-domestic-suppliers.json`을 열어 JSON array 형태인지 확인합니다.
4. `/admin/migrations/notion-csv`로 이동합니다.
5. `Target Table`을 `domestic_suppliers`로 선택합니다.
6. `Rows JSON`에 `staging-domestic-suppliers.json` 내용을 붙여 넣습니다.
7. `Stage Rows`를 클릭합니다.
8. batch에서 `Validate`를 클릭합니다.
9. 오류가 0개이면 `Approve` 후 `Import`합니다.
10. Supabase 또는 `/admin/domestic-suppliers`에서 생성된 supplier UUID를 확인합니다.
11. `supplier-products-relationship-rows.json`의 관계 키를 실제 supplier UUID로 치환합니다.
12. `supplier_products` target으로 다시 staging, validate, approve, import합니다.
13. 생성된 product UUID를 확인합니다.
14. `supplier-prices-relationship-rows.json`의 관계 키를 실제 product UUID로 치환합니다.
15. `supplier_prices` target으로 staging, validate, approve, import합니다.
16. 이미지가 있다면 Storage에 업로드 후 `supplier-media-relationship-rows.json`을 `supplier_media` target으로 import합니다.

## 6. 주의사항

- 변환기는 운영 테이블에 직접 insert하지 않습니다. 반드시 관리자 migration 화면의 승인 단계를 거칩니다.
- `company_id`, `domestic_supplier_id`, `supplier_product_id`는 실제 Supabase UUID가 필요합니다.
- 이미지는 DB row만 만든다고 표시되지 않습니다. 먼저 Supabase Storage에 업로드하고 `storage_path`를 연결해야 합니다.
- 한 공급사 또는 한 상품에 이미지는 최대 10장까지만 연결합니다.
- 식당은 공급사 하나에 여러 메뉴 product를 연결합니다.
- 관광지는 관광지 하나에 여러 ticket product를 연결하고, 성인/아동 가격은 price row 또는 metadata로 구분합니다.
- 차량은 공급사, 차량 종류, From/To 구간, 추가 시간 요금을 분리해서 구조화합니다.

자세한 팀 테스트 및 CSV import 절차는 `docs/team-test-runbook.md`를 기준 문서로 사용합니다.

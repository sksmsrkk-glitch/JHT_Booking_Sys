# Notion Markdown Export 변환기

Notion에서 CSV가 아니라 페이지 export 형태로 내려받은 ZIP은 `.md`, 이미지, 동영상 파일로 구성됩니다.
이 파일은 `/admin/migrations/notion-csv`에 바로 붙여 넣을 수 없으므로, 먼저 Supabase import용 JSON으로 변환합니다.

## 실행 명령

```bash
npm run convert:notion-md -- "C:\Users\Issac\Downloads\notion-export.zip" --out tmp/notion-md-import
```

실제 운영 DB에 바로 넣을 공급사 row를 만들려면 JHT 회사 UUID를 함께 지정합니다.

```bash
npm run convert:notion-md -- "C:\Users\Issac\Downloads\notion-export.zip" --out tmp/notion-md-import --company-id "JHT_COMPANY_UUID"
```

## 출력 파일

| 파일 | 용도 |
|---|---|
| `notion-md-supabase-import-plan.json` | 공급사, 상품, 가격, 미디어를 관계 키로 묶은 전체 변환 결과 |
| `staging-domestic-suppliers.json` | 기존 Notion staging API에 넣을 수 있는 공급사 row payload |
| `supplier-products-relationship-rows.json` | 공급사 생성 후 UUID를 연결해야 하는 상품 row 목록 |
| `supplier-prices-relationship-rows.json` | 상품 생성 후 UUID를 연결해야 하는 가격 row 목록 |
| `supplier-media-relationship-rows.json` | 이미지/영상 파일과 Supabase Storage 경로 후보 목록 |
| `manifest.json` | 변환 요약과 경고 메시지 |

## 매핑 기준

| Notion 속성 | Supabase 대상 |
|---|---|
| 페이지 제목 | `domestic_suppliers.name_ko` |
| `상호명 (EN)` | `domestic_suppliers.name_en` |
| `지역_광역`, `지역 명칭` | `region_level1`, `region_level2` |
| `주소` | `domestic_suppliers.address` |
| `파트너사 구분`, `컨텐츠 유형` | `category`, `product_type`, `search_keywords` |
| `상품 목록` | `supplier_products` |
| `관람료` | `supplier_prices.cost_amount` |
| 이미지/영상 링크 | `supplier_media` 후보 row와 Storage path |

## 주의 사항

- 변환기는 운영 테이블에 직접 insert하지 않습니다. 먼저 JSON을 만들고 사람이 검수합니다.
- `company_id`, `domestic_supplier_id`, `supplier_product_id`는 실제 Supabase UUID가 필요합니다.
- 이미지/영상은 DB row뿐 아니라 Supabase Storage 업로드 단계가 별도로 필요합니다.
- `사용 여부: 확인 필요`인 Notion 페이지는 기본적으로 `inactive`로 변환됩니다.

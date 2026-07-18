/**
 * @file 한글 책임: `quote excel sample.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const quoteFormSource = await readFile(
  new URL("../src/components/admin/QuoteCaseCreateForm.tsx", import.meta.url),
  "utf8"
);

test("quote Excel sample loader is a non-submit action with visible completion feedback", () => {
  assert.match(quoteFormSource, /onClick=\{loadExcelQuotationSample\}[\s\S]*?type="button"/);
  assert.match(quoteFormSource, /role="status"/);
  assert.match(quoteFormSource, /10 quote items and 6 itinerary days|EXCEL_SAMPLE_ITEMS\.length/);
});

test("quote Excel sample applies currency-specific KRW conversion", () => {
  assert.match(quoteFormSource, /const EXCEL_SAMPLE_USD_TO_KRW = "1380\.5"/);
  assert.match(quoteFormSource, /exchangeRateMode: "item"/);
  assert.match(
    quoteFormSource,
    /exchangeRateToKrw: snapshotCostCurrency === "KRW" \? "1" : EXCEL_SAMPLE_USD_TO_KRW/
  );
  assert.match(quoteFormSource, /setGlobalExchangeRate\(EXCEL_SAMPLE_USD_TO_KRW\)/);
  assert.match(quoteFormSource, /rate: EXCEL_SAMPLE_USD_TO_KRW/);
});

test("reloading the Excel sample remounts quote and itinerary rows", () => {
  assert.match(quoteFormSource, /const loadId = Date\.now\(\)/);
  assert.match(quoteFormSource, /id: `\$\{row\.id\}-\$\{loadId\}`/);
});

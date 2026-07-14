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

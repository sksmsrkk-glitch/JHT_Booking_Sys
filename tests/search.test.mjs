/**
 * @file 한글 책임: 목록 검색 공용 유틸(토큰-AND, 필드-OR, LIKE 이스케이프)의 계약을 고정합니다.
 * 다중 키워드가 어순·인접에 무관하게 매칭되고, 특수문자가 주입 없이 리터럴로 처리되는지 검증합니다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { applySearch, buildSearchClauses, escapeSearchToken, tokenizeSearch } from "../src/lib/search.mjs";

test("multi-keyword search is order-independent (token AND, field OR)", () => {
  const clauses = buildSearchClauses("Lotte Busan", ["name_ko", "name_en"]);
  // 토큰마다 하나의 .or() 절이 생성되어 체이닝 시 AND가 됩니다.
  assert.equal(clauses.length, 2);
  assert.equal(clauses[0], "name_ko.ilike.%Lotte%,name_en.ilike.%Lotte%");
  assert.equal(clauses[1], "name_ko.ilike.%Busan%,name_en.ilike.%Busan%");

  // 어순을 바꿔도 동일한 토큰 집합 → 같은 매칭 대상.
  const reordered = buildSearchClauses("Busan Lotte", ["name_ko", "name_en"]);
  assert.deepEqual(new Set(reordered), new Set(clauses.slice().reverse()));
});

test("LIKE wildcards are escaped so specials match literally", () => {
  assert.equal(escapeSearchToken("50%"), "50\\%");
  assert.equal(escapeSearchToken("Deal_X"), "Deal\\_X");
  assert.equal(escapeSearchToken("a\\b"), "a\\\\b");
  // 이스케이프된 _는 단일문자 와일드카드가 아니라 리터럴이어야 합니다.
  const clause = buildSearchClauses("Deal_X", ["name"])[0];
  assert.equal(clause, "name.ilike.%Deal\\_X%");
});

test("PostgREST .or() structural characters are stripped to prevent injection", () => {
  // 쉼표/괄호/별표는 .or() 파서를 깨뜨리므로 공백으로 치환됩니다.
  assert.equal(escapeSearchToken("a,b"), "a b");
  assert.equal(escapeSearchToken("name.ilike.x)"), "name.ilike.x");
  assert.equal(escapeSearchToken("(evil)"), "evil");
  assert.equal(escapeSearchToken("*"), "");
});

test("blank and whitespace-only searches produce no clauses", () => {
  assert.deepEqual(buildSearchClauses("", ["name"]), []);
  assert.deepEqual(buildSearchClauses("   ", ["name"]), []);
  assert.deepEqual(buildSearchClauses(null, ["name"]), []);
  assert.deepEqual(tokenizeSearch("  Seoul   Busan  "), ["Seoul", "Busan"]);
});

test("token count is capped to keep the query bounded", () => {
  const clauses = buildSearchClauses("a b c d e f g h", ["name"]);
  assert.equal(clauses.length, 6);
});

test("feature queries route list search through the shared token-AND helper", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = [
    "src/features/agency/queries.ts",
    "src/features/costing/queries.ts",
    "src/features/countries/queries.ts",
    "src/features/finance/queries.ts",
    "src/features/operations/queries.ts",
    "src/features/quotation/queries.ts",
    "src/features/reservation/queries.ts",
    "src/features/supplier/queries.ts"
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /from "@\/lib\/search\.mjs"/, `${file} should import the shared search helper`);
    // 예전의 단일 문자열 부분일치 검색(.or(`field.ilike.%${q}%`))이 다시 들어오면 안 됩니다.
    assert.doesNotMatch(source, /\.or\(`[^`]*ilike\.%\$\{q\}/, `${file} still uses a raw single-token ilike search`);
  }
});

test("partner portal list pages expose search on public-safe fields", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

  // 파트너 4개 리스트 페이지에 검색 입력이 있어야 합니다.
  for (const page of [
    "src/app/agency/quote-cases/page.tsx",
    "src/app/agency/reservations/page.tsx",
    "src/app/agency/invoices/page.tsx",
    "src/app/agency/inquiries/page.tsx"
  ]) {
    const source = await read(page);
    assert.match(source, /type="search" name="q"/, `${page} should render a search box`);
  }

  // 파트너 쿼리는 공용 검색 유틸을 쓰고, 공개 안전 필드만 검색해야 합니다(원가·마진 필드 없음).
  const portal = await read("src/features/agency-portal/queries.ts");
  assert.match(portal, /from "@\/lib\/search\.mjs"/);
  assert.doesNotMatch(portal, /applySearch\([^)]*(supplier_cost|margin|internal_total)/);
});

test("applySearch chains one .or() per token (AND semantics)", () => {
  const calls = [];
  const fakeQuery = {
    or(clause) {
      calls.push(clause);
      return this;
    }
  };
  applySearch(fakeQuery, "Seoul Busan", ["reservation_code", "tour_name"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "reservation_code.ilike.%Seoul%,tour_name.ilike.%Seoul%");
  assert.equal(calls[1], "reservation_code.ilike.%Busan%,tour_name.ilike.%Busan%");
});

/**
 * @file 한글 책임: `date range.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isIsoDate, normalizeDateRange } from "../src/lib/domain/date-range.mjs";

test("ISO date validation rejects malformed and impossible dates", () => {
  assert.equal(isIsoDate("2026-07-01"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-7-1"), false);
  assert.equal(isIsoDate("07/01/2026"), false);
  assert.equal(isIsoDate(""), false);
  assert.equal(isIsoDate(null), false);
});

test("inverted date ranges are swapped instead of returning empty results", () => {
  // 스크린샷 재현 사례: 시작 2026-07-01, 종료 2026-06-12 → 교정 후 정상 구간
  assert.deepEqual(normalizeDateRange("2026-07-01", "2026-06-12"), { from: "2026-06-12", to: "2026-07-01" });
  assert.deepEqual(normalizeDateRange("2026-06-12", "2026-07-01"), { from: "2026-06-12", to: "2026-07-01" });
  assert.deepEqual(normalizeDateRange("2026-06-12", "2026-06-12"), { from: "2026-06-12", to: "2026-06-12" });
  // 한쪽만 있거나 형식이 잘못된 값은 손대지 않고 호출자 규칙에 맡깁니다.
  assert.deepEqual(normalizeDateRange(undefined, "2026-07-01"), { from: undefined, to: "2026-07-01" });
  assert.deepEqual(normalizeDateRange("bad", "2026-07-01"), { from: "bad", to: "2026-07-01" });
});

test("every start/end date pair is wired to the range guard", async () => {
  // rangeGroup 페어링이 빠지면 해당 화면만 조용히 검증에서 제외되므로 소스 레벨로 고정합니다.
  const pairSites = [
    "../src/app/admin/page.tsx",
    "../src/app/admin/workflows/page.tsx",
    "../src/app/admin/confirmations/page.tsx",
    "../src/components/admin/DomesticSupplierCostMasterForms.tsx",
    "../src/components/admin/SupplierProductPriceForms.tsx",
    "../src/components/admin/RoomAssignmentCreateForm.tsx",
    "../src/components/admin/GuideExpenseReportForm.tsx",
    "../src/components/admin/QuoteCaseCreateForm.tsx",
    "../src/components/agency/InquiryCreateForm.tsx"
  ];

  for (const site of pairSites) {
    const source = await readFile(new URL(site, import.meta.url), "utf8");
    const starts = source.match(/rangeRole="start"/g) ?? [];
    const ends = source.match(/rangeRole="end"/g) ?? [];
    assert.ok(starts.length >= 1, `${site} is missing rangeRole="start"`);
    assert.equal(starts.length, ends.length, `${site} has unbalanced start/end range roles`);
  }
});

test("calendar enforcer blocks and corrects inverted ranges", async () => {
  const enforcer = await readFile(new URL("../src/components/CalendarLocaleEnforcer.tsx", import.meta.url), "utf8");
  const input = await readFile(new URL("../src/components/LocaleDateInput.tsx", import.meta.url), "utf8");
  // 종료일 캘린더에서 시작일 이전 날짜는 비활성화되어야 합니다.
  assert.match(enforcer, /minIso && iso < minIso/);
  assert.match(enforcer, /button\.disabled = true/);
  // 직접 타이핑한 역전 값은 반대쪽 필드를 따라오게 교정합니다.
  assert.match(enforcer, /function syncRangePartner/);
  assert.match(enforcer, /addEventListener\("change", \(\) => syncRangePartner\(input\)\)/);
  assert.match(input, /data-jht-range-group=\{rangeGroup\}/);
});

test("list filters normalize inverted ranges server-side", async () => {
  const workflowFilters = await readFile(new URL("../src/features/workflow/filters.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
  const confirmations = await readFile(new URL("../src/app/admin/confirmations/page.tsx", import.meta.url), "utf8");
  assert.match(workflowFilters, /normalizeDateRange/);
  assert.match(dashboard, /normalizeDateRange/);
  assert.match(confirmations, /normalizeDateRange/);
});

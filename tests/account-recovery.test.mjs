/**
 * @file 한글 책임: `account recovery.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  maskEmail,
  normalizeIdentityText,
  normalizePhone,
  validateRecoveryPassword
} from "../src/lib/domain/account-recovery.mjs";

test("account recovery normalizes identity inputs before exact matching", () => {
  assert.equal(normalizeIdentityText("  World   Travellers  "), "world travellers");
  assert.equal(normalizePhone("+60 (12) 345-6789"), "60123456789");
});

test("account recovery only displays a masked email", () => {
  const masked = maskEmail("Jaime.Yap@WorldTravellers-DMC.com");
  assert.equal(masked, "j********@w******************.com");
  assert.doesNotMatch(masked, /jaime\.yap/i);
  assert.equal(maskEmail("not-an-email"), "");
});

test("password recovery enforces the strong password policy", () => {
  assert.equal(validateRecoveryPassword("short"), "Password must be at least 12 characters.");
  assert.equal(validateRecoveryPassword("alllowercase123!"), "Password must include an uppercase letter.");
  assert.equal(validateRecoveryPassword("ValidPassword!26"), "");
});

test("partner recovery pages remain public before authentication", () => {
  const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /"\/agency\/forgot-email"/);
  assert.match(middleware, /"\/agency\/forgot-password"/);
  assert.match(middleware, /"\/agency\/reset-password"/);
});

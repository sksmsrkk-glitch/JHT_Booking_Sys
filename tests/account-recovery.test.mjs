import assert from "node:assert/strict";
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

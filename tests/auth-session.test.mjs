import assert from "node:assert/strict";
import test from "node:test";

import { isAccessTokenStale, resolvePostLoginPath } from "../src/lib/domain/auth-session.mjs";

test("post-login redirects stay inside the selected portal", () => {
  assert.equal(resolvePostLoginPath("internal", "/admin/quote-cases?q=thai"), "/admin/quote-cases?q=thai");
  assert.equal(resolvePostLoginPath("agency", "/agency/inquiries/new"), "/agency/inquiries/new");
  assert.equal(resolvePostLoginPath("agency", "/admin"), "/agency");
  assert.equal(resolvePostLoginPath("internal", "https://evil.example/admin"), "/admin");
  assert.equal(resolvePostLoginPath("internal", "//evil.example/admin"), "/admin");
});

test("session refresh detects expired and near-expiry JWTs", () => {
  const now = 1_800_000_000;
  assert.equal(isAccessTokenStale(jwtWithExpiry(now + 30), now, 60), true);
  assert.equal(isAccessTokenStale(jwtWithExpiry(now + 300), now, 60), false);
  assert.equal(isAccessTokenStale("runtime-smoke-token", now, 60), false);
});

test("middleware keeps partner landing public while protecting partner records", async () => {
  const { readFile } = await import("node:fs/promises");
  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /"\/agency"/);
  assert.match(middleware, /REFRESH_TOKEN_COOKIE/);
  assert.match(middleware, /refreshSupabaseSession/);
});

function jwtWithExpiry(exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

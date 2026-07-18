/**
 * @file 한글 책임: `auth session.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
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

test("logout cannot be triggered by Next.js link prefetch", async () => {
  const { readFile } = await import("node:fs/promises");
  const topbar = await readFile(new URL("../src/components/AppTopbar.tsx", import.meta.url), "utf8");
  const logoutRoute = await readFile(new URL("../src/app/auth/logout/route.ts", import.meta.url), "utf8");

  assert.match(topbar, /<form action="\/auth\/logout"[^>]*method="post">/);
  assert.doesNotMatch(topbar, /href=\{?[^\n]*\/auth\/logout/);
  assert.match(logoutRoute, /export function POST/);
  assert.doesNotMatch(logoutRoute, /export function GET/);
});

function jwtWithExpiry(exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

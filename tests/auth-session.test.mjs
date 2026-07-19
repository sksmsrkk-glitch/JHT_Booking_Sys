/**
 * @file 한글 책임: `auth session.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  extractBearerToken,
  getVerifiedAccessTokenClaims,
  isAccessTokenForProject,
  isAccessTokenStale,
  resolvePostLoginPath
} from "../src/lib/domain/auth-session.mjs";

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
  assert.equal(isAccessTokenStale("runtime-smoke-token", now, 60), true);
});

test("middleware token checks reject another Supabase project", () => {
  const projectUrl = "https://current-project.supabase.co";
  const currentToken = jwtWithClaims({ exp: 1_900_000_000, iss: `${projectUrl}/auth/v1`, sub: "user-1" });
  const oldToken = jwtWithClaims({ exp: 1_900_000_000, iss: "https://old-project.supabase.co/auth/v1", sub: "user-1" });

  assert.equal(isAccessTokenForProject(currentToken, projectUrl), true);
  assert.equal(isAccessTokenForProject(oldToken, projectUrl), false);
  assert.equal(isAccessTokenForProject("not-a-jwt", projectUrl), false);
});

test("request claims verification always passes the explicit bearer token", async () => {
  let receivedToken = "";
  const authClient = {
    async getClaims(token) {
      receivedToken = token;
      return { data: { claims: { sub: "user-1" } }, error: null };
    }
  };

  const claims = await getVerifiedAccessTokenClaims(authClient, "signed-access-token");
  assert.equal(receivedToken, "signed-access-token");
  assert.equal(claims.sub, "user-1");
  assert.equal(extractBearerToken("Bearer signed-access-token"), "signed-access-token");
  assert.equal(extractBearerToken("Basic credentials"), "");
});

test("middleware keeps partner landing public while protecting partner records", async () => {
  const { readFile } = await import("node:fs/promises");
  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  const runtimeSmoke = await readFile(new URL("../scripts/runtime-smoke.mjs", import.meta.url), "utf8");
  const sessionRoute = await readFile(new URL("../src/app/auth/session/route.ts", import.meta.url), "utf8");
  assert.match(middleware, /"\/agency"/);
  assert.match(middleware, /REFRESH_TOKEN_COOKIE/);
  assert.match(middleware, /refreshSupabaseSession/);
  assert.match(runtimeSmoke, /isProtectedSurfacePath/);
  assert.doesNotMatch(runtimeSmoke, /cookie:\s*"jht_access_token=runtime-smoke-token"/);
  assert.match(sessionRoute, /isVerifiedAccessToken\(payload\.accessToken, requestUrl\)/);
  assert.match(sessionRoute, /getVerifiedAccessTokenClaims\(supabase\.auth, accessToken\)/);
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
  return jwtWithClaims({ exp });
}

function jwtWithClaims(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `header.${payload}.signature`;
}

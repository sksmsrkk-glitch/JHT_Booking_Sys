/**
 * @file 한글 책임: `auth session.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCESS_TOKEN_COOKIE,
  AGENCY_ACCESS_TOKEN_COOKIE,
  AGENCY_REFRESH_TOKEN_COOKIE,
  extractBearerToken,
  getVerifiedAccessTokenClaims,
  isAccessTokenForProject,
  isAccessTokenStale,
  normalizeSessionSurface,
  REFRESH_TOKEN_COOKIE,
  resolvePostLoginPath,
  resolveSessionSurface,
  sessionCookieNames
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

test("session cookies are fully separated per portal surface", () => {
  // 파트너 로그인이 직원 어드민 세션을 덮어쓰지 않으려면 두 포털의 쿠키 이름이 절대 겹치면 안 됩니다.
  const internal = sessionCookieNames("internal");
  const agency = sessionCookieNames("agency");
  assert.equal(internal.access, ACCESS_TOKEN_COOKIE);
  assert.equal(internal.refresh, REFRESH_TOKEN_COOKIE);
  assert.equal(agency.access, AGENCY_ACCESS_TOKEN_COOKIE);
  assert.equal(agency.refresh, AGENCY_REFRESH_TOKEN_COOKIE);
  assert.equal(new Set([internal.access, internal.refresh, agency.access, agency.refresh]).size, 4);
  // 어느 한쪽 이름이 다른 쪽의 접두어가 되면 startsWith 기반 쿠키 파싱이 오염됩니다.
  assert.equal(agency.access.startsWith(internal.access), false);
  assert.equal(internal.access.startsWith(agency.access), false);

  // 파트너 화면·파트너 API만 agency 세션이고, 알 수 없는 값은 넓은 권한으로 승격되지 않습니다.
  assert.equal(resolveSessionSurface("/agency/reservations"), "agency");
  assert.equal(resolveSessionSurface("/api/agency/context"), "agency");
  assert.equal(resolveSessionSurface("/admin/quote-cases"), "internal");
  assert.equal(resolveSessionSurface("/api/workflows"), "internal");
  assert.equal(resolveSessionSurface("/agencies"), "internal");
  assert.equal(normalizeSessionSurface("spoofed"), "internal");
});

test("middleware keeps partner landing public while protecting partner records", async () => {
  const { readFile } = await import("node:fs/promises");
  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  const runtimeSmoke = await readFile(new URL("../scripts/runtime-smoke.mjs", import.meta.url), "utf8");
  const sessionRoute = await readFile(new URL("../src/app/auth/session/route.ts", import.meta.url), "utf8");
  assert.match(middleware, /"\/agency"/);
  assert.match(middleware, /sessionCookieNames\(resolveSessionSurface\(path\)\)/);
  assert.match(middleware, /refreshSupabaseSession/);
  // 서버 컴포넌트가 신뢰하는 surface/path 헤더는 미들웨어가 항상 덮어써야 위조가 불가능합니다.
  assert.match(middleware, /requestHeaders\.set\("x-jht-surface", surface\)/);
  assert.match(middleware, /requestHeaders\.set\("x-jht-path", path\)/);
  assert.match(runtimeSmoke, /isProtectedSurfacePath/);
  assert.doesNotMatch(runtimeSmoke, /cookie:\s*"jht_access_token=runtime-smoke-token"/);
  assert.match(sessionRoute, /verifyAccessTokenForSurface\(payload\.accessToken, surface, requestUrl\)/);
  assert.match(sessionRoute, /getVerifiedAccessTokenClaims\(supabase\.auth, accessToken\)/);
  // 로그인 시점에 포털 소속(내부 역할·활성 파트너 계정)을 검증해야 교차 세션이 아예 만들어지지 않습니다.
  assert.match(sessionRoute, /requireInternalUser\(supabase\)/);
  assert.match(sessionRoute, /requireAgencyUser\(supabase\)/);
});

test("portal layouts redirect role-less sessions instead of leaking per-panel errors", async () => {
  const { readFile } = await import("node:fs/promises");
  const adminLayout = await readFile(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8");
  const agencyLayout = await readFile(new URL("../src/app/agency/layout.tsx", import.meta.url), "utf8");
  assert.match(adminLayout, /getInternalPageContext\(\)/);
  assert.match(adminLayout, /redirect\("\/auth\/login\?reason=internal-role"\)/);
  assert.match(adminLayout, /"\/admin\/bootstrap"/);
  assert.match(agencyLayout, /getAgencyPageContext\(\)/);
  assert.match(agencyLayout, /redirect\("\/agency\/login\?reason=agency-account"\)/);
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

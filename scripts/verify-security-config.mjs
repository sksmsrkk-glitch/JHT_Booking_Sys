import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const nextConfig = readFile("next.config.mjs");
const loginPage = readFile("src/components/auth/SupabaseLoginForm.tsx");
const logoutRoute = readFile("src/app/auth/logout/route.ts");
const sessionRoute = readFile("src/app/auth/session/route.ts");
const middleware = readFile("src/middleware.ts");
const httpHelpers = readFile("src/lib/api/http.ts");
const runtimeSmoke = readFile("scripts/runtime-smoke.mjs");
const launchRunbook = readFile("docs/launch-runbook.md");
const failures = [];

const requiredHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
];

for (const header of requiredHeaders) {
  if (!nextConfig.includes(`key: "${header.key}"`) || !nextConfig.includes(`value: "${header.value}"`)) {
    failures.push(`Missing or changed security header in next.config.mjs: ${header.key}: ${header.value}`);
  }
}

for (const directive of ["camera=()", "microphone=()", "geolocation=()"]) {
  if (!nextConfig.includes(directive)) {
    failures.push(`Permissions-Policy is missing directive: ${directive}`);
  }
}

if (!loginPage.includes("fetch(\"/auth/session\"") || !loginPage.includes("expiresIn: data.session.expires_in") || loginPage.includes("document.cookie")) {
  failures.push("Login page must create the auth cookie through the server session route, not document.cookie");
}

for (const snippet of [
  "httpOnly: true",
  "sameSite: \"lax\"",
  "path: \"/\"",
  "maxAge,",
  "resolveMaxAgeSeconds(payload.expiresIn)",
  "fallbackMaxAgeSeconds",
  "maximumMaxAgeSeconds",
  "minimumMaxAgeSeconds",
  "const secure = isHttpsRequest(request, requestUrl)",
  "REFRESH_TOKEN_COOKIE",
  "refreshTokenMaxAgeSeconds"
]) {
  if (!sessionRoute.includes(snippet)) {
    failures.push(`Session route is missing secure cookie attribute or helper: ${snippet}`);
  }
}

for (const snippet of [
  "isAllowedOrigin(request, requestUrl)",
  "request.headers.get(\"origin\")",
  "request.headers.get(\"host\")",
  "request.headers.get(\"x-forwarded-host\")",
  "Invalid session origin"
]) {
  if (!sessionRoute.includes(snippet)) {
    failures.push(`Session route is missing origin protection: ${snippet}`);
  }
}

if (!sessionRoute.includes("x-forwarded-proto") || !logoutRoute.includes("x-forwarded-proto")) {
  failures.push("Auth cookie routes must respect x-forwarded-proto for HTTPS deployments behind a proxy");
}

if (!sessionRoute.includes("\"Cache-Control\": \"no-store\"") || !logoutRoute.includes("Cache-Control") || !logoutRoute.includes("no-store")) {
  failures.push("Auth session/logout responses must set Cache-Control: no-store");
}

if (!httpHelpers.includes("Cache-Control") || !httpHelpers.includes("no-store") || !httpHelpers.includes("jsonResponse")) {
  failures.push("Shared API JSON responses must set Cache-Control: no-store");
}

if (!httpHelpers.includes("...callerHeaders,\n      ...noStoreHeaders")) {
  failures.push("Shared API JSON responses must enforce Cache-Control: no-store after caller headers are merged");
}

if (
  !logoutRoute.includes("sameSite: \"lax\"") ||
  !logoutRoute.includes("const secure = requestUrl.protocol === \"https:\" || request.headers.get(\"x-forwarded-proto\") === \"https\"") ||
  !logoutRoute.includes("REFRESH_TOKEN_COOKIE")
) {
  failures.push("Logout cookie clearing is missing SameSite lax or HTTPS-aware secure option");
}

for (const snippet of [
  "REFRESH_TOKEN_COOKIE",
  "refreshSupabaseSession",
  "grant_type=refresh_token",
  "continueWithRefreshedSession",
  "redirectToLogin"
]) {
  if (!middleware.includes(snippet)) {
    failures.push(`Middleware is missing persistent-session behavior: ${snippet}`);
  }
}

for (const snippet of [
  "path: \"/auth/session\"",
  "origin: baseUrl",
  "\"x-forwarded-proto\": \"https\"",
  "Max-Age=120",
  "HttpOnly",
  "Secure",
  "SameSite=lax",
  "origin: \"https://evil.example\"",
  "Invalid session origin",
  "cache-control",
  "no-store"
]) {
  if (!runtimeSmoke.includes(snippet)) {
    failures.push(`Runtime smoke must verify auth session/cookie security behavior: ${snippet}`);
  }
}

if (!launchRunbook.includes("Confirm cookies are sent only over HTTPS in production.")) {
  failures.push("Launch runbook must keep the production HTTPS-only cookie confirmation");
}

if (failures.length > 0) {
  console.error("Security config verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Security config verification passed for headers, auth cookies, and launch runbook HTTPS guidance.");

function readFile(path) {
  return readFileSync(resolve(path), "utf8");
}

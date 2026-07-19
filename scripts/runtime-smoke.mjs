/**
 * @file 한글 책임: `runtime smoke` 운영 보조 명령의 입력, 변환 및 실행 절차를 담당합니다.
 * 반복 실행과 실패 재시도를 고려해 원본 데이터와 비밀값을 훼손하거나 로그로 노출하지 않도록 경계를 유지합니다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.SMOKE_PORT ?? 3107);
const baseUrl = `http://127.0.0.1:${port}`;
const requestTimeoutMs = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 15000);
const nextCliPath = "node_modules/next/dist/bin/next";
const apiRoot = resolve("src/app/api");
const handlerMethodPattern =
  /\bexport\s+(?:async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(|const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*instrumentApiRoute\([^,]+,\s*async\s*\()/g;
const smokeUuid = "00000000-0000-4000-8000-000000000001";
const mutationSmokePayload = {
  action: "approve",
  agencyAccountId: smokeUuid,
  agencyReferenceNo: "SMOKE-REF",
  authUserId: smokeUuid,
  category: "hotel",
  code: "SMOKE",
  companyId: smokeUuid,
  countryCode: "US",
  csvRows: [],
  email: "runtime-smoke@example.com",
  fullName: "Runtime Smoke",
  invoiceId: smokeUuid,
  name: "Runtime Smoke",
  nameEn: "Runtime Smoke",
  nameKo: "Runtime Smoke",
  originalFilename: "runtime-smoke.csv",
  acceptedQuoteVersionId: smokeUuid,
  quoteCaseId: smokeUuid,
  quoteVersionId: smokeUuid,
  reservationId: smokeUuid,
  roles: ["sales"],
  rows: [],
  status: "draft",
  storagePath: "runtime-smoke/runtime-smoke.csv",
  targetTable: "domestic_suppliers",
  title: "Runtime smoke",
  tourName: "Runtime smoke tour"
};

const checks = [
  { path: "/", status: 200, includes: ["Jungho Travel Operations Platform", "Internal Workbench", "Overseas Agency Portal"] },
  { path: "/admin", status: 200, includes: ["Operation Admin", "Operations Dashboard"] },
  { path: "/agency", status: 200, includes: ["Partner Work Dashboard", "Customer-safe boundary"] },
  { path: "/agency/login", status: 200, includes: ["Partner Log In", "Partner account access"] },
  { path: "/agency/account/users", status: 200, includes: ["User Management", "Account users could not load"] },
  { path: "/auth/login", status: 200, includes: ["Internal Log In", "Supabase user"] },
  { path: "/auth/forgot-email", status: 200, includes: ["Find account email", "masked email"] },
  { path: "/auth/forgot-password", status: 200, includes: ["Reset password", "one-time recovery link"] },
  { path: "/auth/reset-password", status: 200, includes: ["Set a new password", "Secure Recovery"] },
  { path: "/agency/forgot-email", status: 200, includes: ["Find account email", "Partner Account Recovery"] },
  { path: "/agency/forgot-password", status: 200, includes: ["Reset password", "Partner Account Recovery"] },
  { path: "/agency/reset-password", status: 200, includes: ["Set a new password", "Partner Secure Recovery"] },
  { path: "/admin/bootstrap", status: 200, includes: ["Admin Bootstrap", "Create Initial Admin"] },
  { path: "/admin/readiness", status: 200, includes: ["V1 Readiness"] },
  { path: "/admin/companies", status: 200, includes: ["Companies", "Admin role required"] },
  { path: "/admin/users", status: 200, includes: ["Internal Users", "Admin role required"] },
  { path: "/admin/account-recovery", status: 200, includes: ["Account Recovery", "Recovery requests could not load"] },
  { path: "/admin/agencies", status: 200, includes: ["Overseas Agencies", "Internal role required"] },
  { path: "/admin/domestic-suppliers", status: 200, includes: ["Domestic Suppliers", "Internal role required"] },
  { path: "/admin/exchange-rates", status: 200, includes: ["Exchange Rates", "Internal role required"] },
  { path: "/admin/costing/search", status: 200, includes: ["Cost Search", "Internal role required"] },
  { path: "/admin/quote-cases", status: 200, includes: ["Quote Cases", "Internal role required"] },
  { path: "/admin/reservations", status: 200, includes: ["Reservations", "Internal role required"] },
  { path: "/admin/reservations/incomplete", status: 200, includes: ["Incomplete Reservation Follow-up", "Reservations could not load"] },
  {
    path: "/admin/reservations/00000000-0000-4000-8000-000000000001/operation-checklist",
    status: 200,
    includes: ["Reservation Operation Checklist", "Internal role required"]
  },
  { path: "/admin/confirmations", status: 200, includes: ["Final Confirmations", "Confirmations could not load"] },
  {
    path: "/admin/confirmations/00000000-0000-4000-8000-000000000001",
    status: 200,
    includes: ["Confirmation Document", "Confirmation could not load"]
  },
  { path: "/admin/guide-expenses", status: 200, includes: ["Guide Expense Reports", "Could not load live reservations"] },
  {
    path: "/admin/guide-expenses/00000000-0000-4000-8000-000000000001",
    status: 200,
    includes: ["Guide Expense Report", "Report could not load"]
  },
  { path: "/admin/workflows", status: 200, includes: ["Workflow Communication", "Workflows could not load"] },
  { path: "/admin/workflows/Q-2026-TH-001", status: 200, includes: ["Workflow Communication", "Workflow not available"] },
  { path: "/admin/operations/tasks", status: 200, includes: ["Operation Tasks", "Internal role required"] },
  { path: "/admin/supplier-messages", status: 200, includes: ["Supplier Messages", "Internal role required"] },
  { path: "/admin/finance/invoices", status: 200, includes: ["Finance", "Finance role required"] },
  { path: "/admin/finance/settlements", status: 200, includes: ["Settlements", "Finance role required"] },
  { path: "/admin/automation/gmail-review", status: 200, includes: ["Gmail Review", "Internal role required"] },
  { path: "/admin/automation/failed-jobs", status: 200, includes: ["Failed Jobs", "Internal role required"] },
  { path: "/admin/migrations/notion-csv", status: 200, includes: ["Notion CSV Migration", "Internal role required"] },
  { path: "/admin/audit", status: 200, includes: ["Audit Log", "Internal role required"] },
  { path: "/admin/audit/api-logs", status: 200, includes: ["API Logs", "Internal role required"] },
  { path: "/admin/agencies/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Internal role required"] },
  { path: "/admin/domestic-suppliers/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Internal role required"] },
  { path: "/admin/quote-cases/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Quote Case Detail", "Quote case could not load"] },
  { path: "/admin/reservations/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Reservation Detail", "Reservation could not load"] },
  { path: "/admin/supplier-messages/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Supplier Message Detail", "Message could not load"] },
  { path: "/admin/finance/invoices/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Invoice Detail", "Invoice could not load"] },
  { path: "/agency/inquiries", status: 200, includes: ["Inquiries", "Partner session required"] },
  { path: "/agency/inquiries/new", status: 200, includes: ["New Inquiry", "Inquiry boundary"] },
  { path: "/agency/signup", status: 200, includes: ["Partner Sign-up", "Partner Sign-up Application"] },
  { path: "/agency/quote-cases", status: 200, includes: ["Quotes", "Partner session required"] },
  { path: "/agency/reservations", status: 200, includes: ["Reservations", "Partner session required"] },
  { path: "/agency/invoices", status: 200, includes: ["Invoices", "Partner session required"] },
  { path: "/agency/workflows", status: 200, includes: ["Communication", "Communication could not load"] },
  { path: "/agency/workflows/Q-2026-TH-001", status: 200, includes: ["Overseas Agency Portal", "Workflow not available"] },
  { path: "/agency/quote-cases/fake-share-id", status: 200, includes: ["Quote Detail", "Quote could not load"] },
  { path: "/agency/reservations/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Reservation Detail", "Reservation could not load"] },
  { path: "/agency/reservations/00000000-0000-4000-8000-000000000001/rooming-lists", status: 200, includes: ["Rooming Lists", "Reservation could not load"] },
  { path: "/agency/invoices/00000000-0000-4000-8000-000000000001", status: 200, includes: ["Invoice Detail", "Invoice could not load"] }
];

const apiChecks = buildApiChecks();

const routeChecks = [
  {
    path: "/auth/session",
    method: "POST",
    status: 401,
    body: { accessToken: "runtime-smoke-token", expiresIn: 120, refreshToken: "runtime-smoke-refresh-token" },
    requestHeaders: { origin: baseUrl, "x-forwarded-proto": "https" },
    headers: [{ name: "cache-control", value: "no-store" }],
    includes: ["Invalid or expired access token"]
  },
  {
    path: "/auth/session",
    method: "POST",
    status: 403,
    body: { accessToken: "runtime-smoke-token", expiresIn: 120 },
    requestHeaders: { origin: "https://evil.example" },
    headers: [{ name: "cache-control", value: "no-store" }],
    includes: ["Invalid session origin"]
  },
  {
    path: "/auth/logout",
    method: "GET",
    status: 405
  },
  {
    path: "/auth/logout",
    method: "POST",
    status: 303,
    requestHeaders: { "x-forwarded-proto": "https" },
    headers: [
      { name: "set-cookie", includes: "jht_access_token=;" },
      { name: "set-cookie", includes: "jht_refresh_token=;" },
      { name: "set-cookie", includes: "Secure" },
      { name: "cache-control", value: "no-store" }
    ]
  }
];

const headerChecks = [
  { path: "/", header: "x-content-type-options", value: "nosniff" },
  { path: "/", header: "x-frame-options", value: "DENY" },
  { path: "/", header: "referrer-policy", value: "strict-origin-when-cross-origin" },
  { path: "/api/health", header: "permissions-policy", includes: "camera=()" }
];

if (!existsSync(".next/BUILD_ID")) {
  console.error("Runtime smoke requires a production build. Run `npm run build` first.");
  process.exit(1);
}

if (!existsSync(nextCliPath)) {
  console.error(`Next.js CLI not found at ${nextCliPath}. Run npm install first.`);
  process.exit(1);
}

const server = spawn(process.execPath, [nextCliPath, "start", "-p", String(port), "-H", "127.0.0.1"], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "runtime-smoke-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "runtime-smoke-service-role-key",
    JHT_DEMO_MODE: "",
    AUTOMATION_SECRET: process.env.AUTOMATION_SECRET || "runtime-smoke-automation",
    GMAIL_WEBHOOK_SECRET: process.env.GMAIL_WEBHOOK_SECRET || "runtime-smoke-gmail",
    SUPPLIER_MESSAGE_WEBHOOK_SECRET: process.env.SUPPLIER_MESSAGE_WEBHOOK_SECRET || "runtime-smoke-supplier",
    INITIAL_ADMIN_BOOTSTRAP_SECRET: process.env.INITIAL_ADMIN_BOOTSTRAP_SECRET || "runtime-smoke-bootstrap"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForServer();
  for (const check of checks) {
    await runCheck(check);
  }
  for (const check of apiChecks) {
    await runCheck(check);
  }
  for (const check of routeChecks) {
    await runRouteCheck(check);
  }
  for (const check of headerChecks) {
    await runHeaderCheck(check);
  }
  console.log(
    `Runtime smoke passed for ${checks.length} pages, ${apiChecks.length} API handlers, ${routeChecks.length} app routes, and ${headerChecks.length} headers at ${baseUrl}`
  );
} finally {
  server.kill();
}

/**
 * 파일 시스템에서 발견한 Route Handler의 HTTP 메서드를 읽어 최소 권한 요청 목록을 자동 생성합니다.
 * 신규 API가 추가되면 수동 목록 갱신 없이도 런타임 부팅·응답 규약 검증 대상에 포함됩니다.
 */
function buildApiChecks() {
  return listRouteFiles(apiRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    const path = routePathFromFile(filePath);
    return findExportedHandlers(source).map(({ method, body }) => {
      if (path === "/api/health" && method === "GET") {
        return {
          path,
          method,
          status: 200,
          includes: ["jht-operations-platform", "supabaseUrlConfigured"],
          headers: [{ name: "cache-control", value: "no-store" }]
        };
      }
      if (path === "/api/agency/signup-applications" && method === "POST") {
        return {
          path,
          method,
          status: 400,
          includes: ["country is required"],
          headers: [{ name: "cache-control", value: "no-store" }]
        };
      }
      if (path === "/api/countries" && method === "GET") {
        return {
          path,
          method,
          status: 500,
          includes: ["Internal server error"],
          headers: [{ name: "cache-control", value: "no-store" }]
        };
      }
      if (path === "/api/auth/forgot-email" && method === "POST") {
        return {
          path,
          method,
          status: 400,
          includes: ["accountType must be internal or agency"],
          headers: [{ name: "cache-control", value: "no-store" }]
        };
      }
      if (path === "/api/auth/forgot-password" && method === "POST") {
        return {
          path,
          method,
          status: 400,
          includes: ["accountType must be internal or agency"],
          headers: [{ name: "cache-control", value: "no-store" }]
        };
      }
      if (/\brequireAutomationSecret\s*\(/.test(body)) {
        return { path, method, status: 401, includes: ["Invalid automation secret"], headers: [{ name: "cache-control", value: "no-store" }] };
      }
      if (/\brequireWebhookSecret\s*\(/.test(body)) {
        return { path, method, status: 401, includes: ["Invalid webhook secret"], headers: [{ name: "cache-control", value: "no-store" }] };
      }
      if (/\brequireBootstrapSecret\s*\(/.test(body)) {
        return { path, method, status: 401, includes: ["Invalid bootstrap secret"], headers: [{ name: "cache-control", value: "no-store" }] };
      }
      return { path, method, status: 401, includes: ["Authentication is required"], headers: [{ name: "cache-control", value: "no-store" }] };
    });
  });
}

function listRouteFiles(directory) {
  return readdirSync(directory)
    .flatMap((entry) => {
      const fullPath = resolve(directory, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) return listRouteFiles(fullPath);
      return entry === "route.ts" ? [fullPath] : [];
    })
    .sort();
}

function routePathFromFile(filePath) {
  const relativePath = normalizePath(relative(apiRoot, filePath));
  const routePath = relativePath
    .replace(/\/route\.ts$/, "")
    .replace(/^route\.ts$/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const dynamicMatch = segment.match(/^\[(.+)]$/);
      return dynamicMatch ? smokeUuid : segment;
    })
    .join("/");
  return `/api${routePath ? `/${routePath}` : ""}`;
}

function findExportedHandlers(source) {
  const handlers = [];
  let match;
  while ((match = handlerMethodPattern.exec(source)) !== null) {
    const method = match[1] ?? match[2];
    const bodyStart = findFunctionBodyStart(source, handlerMethodPattern.lastIndex - 1);
    if (bodyStart === -1) {
      handlers.push({ method, body: "" });
      continue;
    }
    const bodyEnd = findMatchingBrace(source, bodyStart);
    handlers.push({ method, body: source.slice(bodyStart, bodyEnd + 1) });
  }
  return handlers;
}

function findFunctionBodyStart(source, openParenIndex) {
  let depth = 0;
  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return source.indexOf("{", index);
    }
  }
  return -1;
}

function findMatchingBrace(source, startIndex) {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return source.length - 1;
}

function normalizePath(path) {
  return path.split(sep).join("/");
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited early with code ${server.exitCode}\n${output}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) });
      if (response.status < 500) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Timed out waiting for next start at ${baseUrl}\n${output}`);
}

async function runCheck({ path, method = "GET", status, includes, headers = [] }) {
  const protectedSurface = isProtectedSurfacePath(path);
  const requestInit = {
    method,
    // 스모크 테스트가 가짜 쿠키로 보호 화면을 통과시키면 실제 인증 회귀를 정상으로 오판하게 됩니다.
    headers: {},
    redirect: protectedSurface ? "manual" : "follow",
    signal: AbortSignal.timeout(requestTimeoutMs)
  };
  if (!["GET", "HEAD"].includes(method)) {
    requestInit.headers = { ...requestInit.headers, "content-type": "application/json" };
    requestInit.body = JSON.stringify(buildMutationSmokePayload(path));
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestInit
  });
  const body = await response.text();

  if (protectedSurface) {
    const loginPath = path.startsWith("/agency") ? "/agency/login" : "/auth/login";
    const location = response.headers.get("location") ?? "";
    const locationPath = location ? new URL(location, baseUrl).pathname : "";
    if (response.status !== 307 || locationPath !== loginPath) {
      throw new Error(`${path} expected an unauthenticated redirect to ${loginPath}, got ${response.status} ${location}`);
    }
    if (/Authentication is required|role required/i.test(body)) {
      throw new Error(`${path} rendered an authorization warning instead of redirecting before page data loading`);
    }
    console.log(`ok ${method} ${path} -> ${loginPath}`);
    return;
  }

  if (response.status !== status) {
    throw new Error(`${path} expected HTTP ${status}, got ${response.status}`);
  }
  for (const text of includes) {
    if (!body.includes(text)) {
      throw new Error(`${path} did not include expected text: ${text}`);
    }
  }
  assertHeaders(response, path, headers);
  console.log(`ok ${method} ${path}`);
}

/** 미들웨어와 동일한 공개/보호 화면 경계를 스모크 테스트에도 적용합니다. */
function isProtectedSurfacePath(path) {
  const publicAgencyPaths = new Set([
    "/agency",
    "/agency/login",
    "/agency/signup",
    "/agency/forgot-email",
    "/agency/forgot-password",
    "/agency/reset-password"
  ]);
  if (path.startsWith("/agency")) return !publicAgencyPaths.has(path);
  if (path.startsWith("/admin")) return path !== "/admin/bootstrap";
  return false;
}

async function runRouteCheck({ path, method = "GET", status, body, requestHeaders = {}, headers = [], includes = [] }) {
  const requestInit = {
    method,
    redirect: "manual",
    headers: { ...requestHeaders },
    signal: AbortSignal.timeout(requestTimeoutMs)
  };
  if (body !== undefined) {
    requestInit.headers = { ...requestInit.headers, "content-type": "application/json" };
    requestInit.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestInit
  });
  if (response.status !== status) {
    throw new Error(`${path} expected HTTP ${status}, got ${response.status}`);
  }
  const responseBody = await response.text();
  for (const text of includes) {
    if (!responseBody.includes(text)) {
      throw new Error(`${path} did not include expected text: ${text}`);
    }
  }
  assertHeaders(response, path, headers);
  console.log(`ok ${method} ${path}`);
}

function assertHeaders(response, path, headers) {
  for (const header of headers) {
    const actual = response.headers.get(header.name);
    if (!actual) {
      throw new Error(`${path} missing expected header: ${header.name}`);
    }
    if (header.value !== undefined && actual !== header.value) {
      throw new Error(`${path} expected ${header.name}: ${header.value}, got ${actual}`);
    }
    if (header.includes !== undefined && !actual.includes(header.includes)) {
      throw new Error(`${path} expected ${header.name} to include ${header.includes}, got ${actual}`);
    }
  }
}

/** 쓰기 API가 인증 검사까지 도달할 수 있는 최소 형태만 제공하며 실제 데이터 변경 성공은 요구하지 않습니다. */
function buildMutationSmokePayload(path) {
  if (path === "/api/agency/signup-applications") {
    const { countryCode: _countryCode, ...payloadWithoutCountry } = mutationSmokePayload;
    return payloadWithoutCountry;
  }
  if (/^\/api\/quote-versions\/[^/]+\/status$/.test(path)) {
    return { ...mutationSmokePayload, status: "sent" };
  }
  return mutationSmokePayload;
}

async function runHeaderCheck({ path, header, value, includes }) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(requestTimeoutMs)
  });
  const actual = response.headers.get(header);
  if (!actual) {
    throw new Error(`${path} missing expected header: ${header}`);
  }
  if (value !== undefined && actual !== value) {
    throw new Error(`${path} expected ${header}: ${value}, got ${actual}`);
  }
  if (includes !== undefined && !actual.includes(includes)) {
    throw new Error(`${path} expected ${header} to include ${includes}, got ${actual}`);
  }
  console.log(`ok ${path} ${header}`);
}

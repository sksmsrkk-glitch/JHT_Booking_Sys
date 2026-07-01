import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const apiRoot = resolve("src/app/api");
const publicRoutes = new Map([
  ["src/app/api/health/route.ts", { methods: new Set(["GET"]), reason: "public health check" }],
  ["src/app/api/agency/signup-applications/route.ts", { methods: new Set(["POST"]), reason: "public partner signup application" }],
  ["src/app/api/countries/route.ts", { methods: new Set(["GET"]), reason: "public country selector options" }]
]);

const guardPatterns = [
  { name: "internal user guard", pattern: /\brequireInternalUser\s*\(/ },
  { name: "admin user guard", pattern: /\brequireAdminUser\s*\(/ },
  { name: "finance user guard", pattern: /\brequireFinanceUser\s*\(/ },
  { name: "agency user guard", pattern: /\brequireAgencyUser\s*\(/ },
  { name: "automation secret guard", pattern: /\brequireAutomationSecret\s*\(/ },
  { name: "webhook secret guard", pattern: /\brequireWebhookSecret\s*\(/ },
  { name: "bootstrap secret guard", pattern: /\brequireBootstrapSecret\s*\(/ },
  { name: "workflow actor guard", pattern: /\bresolveActor\s*\(/ },
  { name: "invoice export loader guard", pattern: /\bloadInvoiceForExport\s*\(/ }
];

const httpMethodPattern = /\bexport\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g;
const failures = [];
let routeCount = 0;
let handlerCount = 0;
let publicHandlerCount = 0;

for (const filePath of listRouteFiles(apiRoot)) {
  routeCount += 1;
  const normalizedPath = normalizePath(relative(process.cwd(), filePath));
  const source = readFileSync(filePath, "utf8");
  const handlers = findExportedHandlers(source);

  if (handlers.length === 0) {
    failures.push(`${normalizedPath} does not export an HTTP handler`);
    continue;
  }

  const publicConfig = publicRoutes.get(normalizedPath);
  for (const handler of handlers) {
    handlerCount += 1;
    if (publicConfig?.methods.has(handler.method)) {
      publicHandlerCount += 1;
      continue;
    }

    const guard = guardPatterns.find((candidate) => candidate.pattern.test(handler.body));
    if (!guard) {
      failures.push(`${normalizedPath} ${handler.method} is missing an auth or secret guard`);
    }
  }
}

for (const allowedPath of publicRoutes.keys()) {
  if (!statExists(resolve(allowedPath))) {
    failures.push(`Public API allowlist references missing route: ${allowedPath}`);
  }
}

if (failures.length > 0) {
  console.error("API guard verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `API guard verification passed for ${routeCount} routes and ${handlerCount} handlers (${publicHandlerCount} public allowlisted).`
);

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

function findExportedHandlers(source) {
  const handlers = [];
  let match;
  while ((match = httpMethodPattern.exec(source)) !== null) {
    const method = match[1];
    const bodyStart = findFunctionBodyStart(source, httpMethodPattern.lastIndex - 1);
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
      if (depth === 0) {
        return source.indexOf("{", index);
      }
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

function statExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

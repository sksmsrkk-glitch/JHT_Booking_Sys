import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const apiRoot = resolve("src/app/api");
const handlerMethodPattern = /\bexport\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g;
const guardPattern =
  /\b(requireInternalUser|requireAgencyUser|requireFinanceUser|requireAdminUser|requireAutomationSecret|requireWebhookSecret|requireBootstrapSecret)\s*\(/g;
const bodyParserPattern = /\brequest\s*\.\s*(json|formData|text|arrayBuffer|blob)\s*\(/g;

const failures = [];

for (const filePath of listRouteFiles(apiRoot)) {
  const source = readFileSync(filePath, "utf8");
  for (const handler of findExportedHandlers(source)) {
    const firstBodyParser = firstMatchIndex(handler.body, bodyParserPattern);
    if (firstBodyParser === -1) continue;

    const firstGuard = firstMatchIndex(handler.body, guardPattern);
    if (firstGuard === -1 || firstBodyParser < firstGuard) {
      failures.push(`${normalizePath(relative(process.cwd(), filePath))} ${handler.method} parses request body before auth/secret guard`);
    }
  }
}

if (failures.length > 0) {
  console.error("API body-order verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`API body-order verification passed for ${listRouteFiles(apiRoot).length} route files.`);

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
  while ((match = handlerMethodPattern.exec(source)) !== null) {
    const method = match[1];
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

function firstMatchIndex(source, pattern) {
  pattern.lastIndex = 0;
  const match = pattern.exec(source);
  return match ? match.index : -1;
}

function normalizePath(path) {
  return path.split(sep).join("/");
}

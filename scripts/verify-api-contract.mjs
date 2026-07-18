/**
 * @file 한글 책임: `verify api contract` 검증기는 저장소의 코드·스키마·문서 계약이 배포 기준을 지키는지 자동 확인합니다.
 * 검사 실패는 사람이 놓치기 쉬운 회귀를 CI와 로컬 검증 단계에서 즉시 차단하도록 명확한 종료 코드로 전달합니다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const apiRoot = resolve("src/app/api");
const contractPath = resolve("docs/api-contract.md");
const httpMethodPattern =
  /\bexport\s+(?:async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(|const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*instrumentApiRoute\([^,]+,\s*async\s*\()/g;
const documentedApiPattern = /`(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/api\/[^` ]+)`/g;

const documentedApis = readDocumentedApis();
const implementedApis = readImplementedApis();
const missingFromContract = [...implementedApis].filter((entry) => !documentedApis.has(entry));
const missingFromImplementation = [...documentedApis].filter((entry) => !implementedApis.has(entry));

if (missingFromContract.length > 0 || missingFromImplementation.length > 0) {
  console.error("API contract verification failed:");
  for (const entry of missingFromContract) {
    console.error(`- Implemented route is missing from docs/api-contract.md: ${entry}`);
  }
  for (const entry of missingFromImplementation) {
    console.error(`- docs/api-contract.md references a missing route handler: ${entry}`);
  }
  process.exit(1);
}

console.log(`API contract verification passed for ${implementedApis.size} documented handlers.`);

function readDocumentedApis() {
  const source = readFileSync(contractPath, "utf8");
  const entries = new Set();
  let match;
  while ((match = documentedApiPattern.exec(source)) !== null) {
    entries.add(normalizeDocumentedEntry(`${match[1]} ${match[2]}`));
  }
  return entries;
}

function readImplementedApis() {
  const entries = new Set();
  for (const filePath of listRouteFiles(apiRoot)) {
    const routePath = routePathFromFile(filePath);
    const source = readFileSync(filePath, "utf8");
    let match;
    while ((match = httpMethodPattern.exec(source)) !== null) {
      entries.add(normalizeImplementedEntry(`${match[1] ?? match[2]} ${routePath}`));
    }
  }
  return entries;
}

function normalizeDocumentedEntry(entry) {
  return entry.replace("GET /api/agency/quote-cases/:shareId", "GET /api/agency/quote-cases/:id");
}

function normalizeImplementedEntry(entry) {
  return entry;
}

function routePathFromFile(filePath) {
  const relativePath = normalizePath(relative(apiRoot, filePath));
  const routePath = relativePath
    .replace(/\/route\.ts$/, "")
    .replace(/^route\.ts$/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/^\[(.+)]$/, ":$1"))
    .join("/");
  return `/api${routePath ? `/${routePath}` : ""}`;
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

function normalizePath(path) {
  return path.split(sep).join("/");
}

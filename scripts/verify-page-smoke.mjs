import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const appRoot = resolve("src/app");
const runtimeSmoke = readFileSync(resolve("scripts/runtime-smoke.mjs"), "utf8");
const smokePagePaths = new Set(readSmokePagePaths(runtimeSmoke));

const dynamicFixtures = new Map([
  ["agencyId", "00000000-0000-4000-8000-000000000001"],
  ["supplierId", "00000000-0000-4000-8000-000000000001"],
  ["quoteCaseId", "00000000-0000-4000-8000-000000000001"],
  ["reservationId", "00000000-0000-4000-8000-000000000001"],
  ["messageId", "00000000-0000-4000-8000-000000000001"],
  ["invoiceId", "00000000-0000-4000-8000-000000000001"],
  ["shareId", "fake-share-id"],
  ["workflowCode", "Q-2026-TH-001"]
]);

const pagePaths = new Set(listPageFiles(appRoot).map((filePath) => pagePathFromFile(filePath)));
const missingFromSmoke = [...pagePaths].filter((path) => !smokePagePaths.has(path));
const staleSmokePaths = [...smokePagePaths].filter((path) => !pagePaths.has(path));
const failures = [];

for (const path of missingFromSmoke) {
  failures.push(`Page route is missing from runtime smoke checks: ${path}`);
}

for (const path of staleSmokePaths) {
  failures.push(`Runtime smoke checks a page that no longer exists: ${path}`);
}

if (failures.length > 0) {
  console.error("Page smoke coverage verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Page smoke coverage verification passed for ${pagePaths.size} page routes.`);

function readSmokePagePaths(source) {
  const checksBlock = source.match(/const checks = \[([\s\S]*?)\];/);
  if (!checksBlock) return [];
  return [...checksBlock[1].matchAll(/\{\s*path:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function listPageFiles(directory) {
  return readdirSync(directory)
    .flatMap((entry) => {
      const fullPath = resolve(directory, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) return listPageFiles(fullPath);
      return entry === "page.tsx" ? [fullPath] : [];
    })
    .sort();
}

function pagePathFromFile(filePath) {
  const relativePath = normalizePath(relative(appRoot, filePath));
  const routePath = relativePath
    .replace(/\/page\.tsx$/, "")
    .replace(/^page\.tsx$/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const dynamicMatch = segment.match(/^\[(.+)]$/);
      if (!dynamicMatch) return segment;
      const fixture = dynamicFixtures.get(dynamicMatch[1]);
      if (!fixture) {
        throw new Error(`Missing smoke fixture for dynamic segment [${dynamicMatch[1]}] in ${relativePath}`);
      }
      return fixture;
    })
    .join("/");
  return routePath ? `/${routePath}` : "/";
}

function normalizePath(path) {
  return path.split(sep).join("/");
}

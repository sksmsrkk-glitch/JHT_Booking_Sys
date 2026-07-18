/**
 * @file 한글 책임: `verify app route smoke` 검증기는 저장소의 코드·스키마·문서 계약이 배포 기준을 지키는지 자동 확인합니다.
 * 검사 실패는 사람이 놓치기 쉬운 회귀를 CI와 로컬 검증 단계에서 즉시 차단하도록 명확한 종료 코드로 전달합니다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const appRoot = resolve("src/app");
const apiRootPrefix = "api/";
const runtimeSmoke = readFileSync(resolve("scripts/runtime-smoke.mjs"), "utf8");
const smokeRoutePaths = new Set(readSmokeRoutePaths(runtimeSmoke));

const dynamicFixtures = new Map([
  ["id", "00000000-0000-4000-8000-000000000001"],
  ["shareId", "fake-share-id"]
]);

const appRoutePaths = new Set(
  listRouteFiles(appRoot)
    .filter((filePath) => !normalizePath(relative(appRoot, filePath)).startsWith(apiRootPrefix))
    .map((filePath) => routePathFromFile(filePath))
);

const missingFromSmoke = [...appRoutePaths].filter((path) => !smokeRoutePaths.has(path));
const staleSmokePaths = [...smokeRoutePaths].filter((path) => !appRoutePaths.has(path));
const failures = [];

for (const path of missingFromSmoke) {
  failures.push(`App route is missing from runtime route smoke checks: ${path}`);
}

for (const path of staleSmokePaths) {
  failures.push(`Runtime route smoke checks an app route that no longer exists: ${path}`);
}

if (failures.length > 0) {
  console.error("App route smoke coverage verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`App route smoke coverage verification passed for ${appRoutePaths.size} app routes.`);

function readSmokeRoutePaths(source) {
  const checksBlock = source.match(/const routeChecks = \[([\s\S]*?)\];/);
  if (!checksBlock) return [];
  return [...checksBlock[1].matchAll(/\{\s*path:\s*"([^"]+)"/g)].map((match) => match[1]);
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
  const relativePath = normalizePath(relative(appRoot, filePath));
  const routePath = relativePath
    .replace(/\/route\.ts$/, "")
    .replace(/^route\.ts$/, "")
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

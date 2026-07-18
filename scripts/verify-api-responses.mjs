/**
 * @file 한글 책임: `verify api responses` 검증기는 저장소의 코드·스키마·문서 계약이 배포 기준을 지키는지 자동 확인합니다.
 * 검사 실패는 사람이 놓치기 쉬운 회귀를 CI와 로컬 검증 단계에서 즉시 차단하도록 명확한 종료 코드로 전달합니다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const apiRoot = resolve("src/app/api");
const failures = [];

for (const filePath of listRouteFiles(apiRoot)) {
  const source = readFileSync(filePath, "utf8");
  if (/\b(Response|NextResponse)\.json\s*\(/.test(source)) {
    failures.push(
      `${normalizePath(relative(process.cwd(), filePath))} uses direct Response.json/NextResponse.json instead of shared no-store API helpers`
    );
  }
}

if (failures.length > 0) {
  console.error("API response verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`API response verification passed for ${listRouteFiles(apiRoot).length} route files.`);

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

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

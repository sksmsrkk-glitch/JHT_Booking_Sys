#!/usr/bin/env node
/**
 * @file 한글 책임: `convert notion markdown export` 운영 보조 명령의 입력, 변환 및 실행 절차를 담당합니다.
 * 반복 실행과 실패 재시도를 고려해 원본 데이터와 비밀값을 훼손하거나 로그로 노출하지 않도록 경계를 유지합니다.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import {
  buildNotionMarkdownImportPlan,
  buildSupplierCostMasterFromNotionDocument,
  parseNotionMarkdownDocument
} from "../src/lib/domain/notion-markdown-import.mjs";

const args = parseArgs(process.argv.slice(2));

if (!args.input) {
  printUsage();
  process.exit(1);
}

const inputPath = resolve(args.input);
if (!existsSync(inputPath)) {
  throw new Error(`Input file or directory does not exist: ${inputPath}`);
}

const outputDir = resolve(args.out ?? "tmp/notion-markdown-import");
mkdirSync(outputDir, { recursive: true });

const workingDir = prepareWorkingDirectory(inputPath);
const markdownFiles = findFiles(workingDir, (filePath) => extname(filePath).toLowerCase() === ".md");

if (markdownFiles.length === 0) {
  throw new Error("No Notion markdown files were found. If this is a Notion database CSV export, use the Notion CSV staging page instead.");
}

const records = markdownFiles.map((filePath) => {
  const document = parseNotionMarkdownDocument({
    content: readFileSync(filePath, "utf8"),
    sourcePath: filePath,
    baseDir: dirname(filePath)
  });
  return buildSupplierCostMasterFromNotionDocument(document, {
    companyId: args.companyId,
    domesticSupplierId: args.domesticSupplierId,
    supplierProductId: args.supplierProductId
  });
});

const plan = buildNotionMarkdownImportPlan(records, {
  sourceName: args.sourceName ?? basename(inputPath)
});

writeJson(join(outputDir, "notion-md-supabase-import-plan.json"), plan);
writeJson(join(outputDir, "staging-domestic-suppliers.json"), plan.stagingPayloads.domesticSuppliers);
writeJson(join(outputDir, "supplier-products-relationship-rows.json"), plan.stagingPayloads.supplierProductsRelationshipRows);
writeJson(join(outputDir, "supplier-prices-relationship-rows.json"), plan.stagingPayloads.supplierPricesRelationshipRows);
writeJson(join(outputDir, "supplier-media-relationship-rows.json"), plan.stagingPayloads.supplierMediaRelationshipRows);
writeJson(join(outputDir, "manifest.json"), {
  inputPath,
  workingDir,
  outputDir,
  markdownFileCount: markdownFiles.length,
  summary: plan.summary,
  warnings: records.flatMap((record) => record.warnings)
});

console.log("Notion markdown conversion complete.");
console.log(`Input: ${inputPath}`);
console.log(`Output: ${outputDir}`);
console.log(
  `Rows: suppliers=${plan.summary.supplierCount}, products=${plan.summary.productCount}, prices=${plan.summary.priceCount}, media=${plan.summary.mediaCount}`
);
if (plan.summary.warningCount > 0) {
  console.log(`Warnings: ${plan.summary.warningCount}. Check ${join(outputDir, "manifest.json")}`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") parsed.out = argv[++index];
    else if (token === "--company-id") parsed.companyId = argv[++index];
    else if (token === "--domestic-supplier-id") parsed.domesticSupplierId = argv[++index];
    else if (token === "--supplier-product-id") parsed.supplierProductId = argv[++index];
    else if (token === "--source-name") parsed.sourceName = argv[++index];
    else if (!parsed.input) parsed.input = token;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
}

function printUsage() {
  console.log(`
Usage:
  npm run convert:notion-md -- <notion-export.zip|extracted-directory> [options]

Options:
  --out <dir>                    Output directory. Default: tmp/notion-markdown-import
  --company-id <uuid>            Real JHT company UUID for domestic_suppliers.company_id
  --domestic-supplier-id <uuid>  Optional existing supplier UUID for product/media rows
  --supplier-product-id <uuid>   Optional existing product UUID for price/media rows
  --source-name <name>           Source label written into generated staging payloads

Notes:
  - ZIP exports with nested Notion ZIP files are extracted automatically.
  - Relationship rows keep lookup keys because products/prices/media need real Supabase UUIDs after supplier creation.
`);
}

function prepareWorkingDirectory(sourcePath) {
  const sourceStats = statSync(sourcePath);
  if (sourceStats.isDirectory()) return sourcePath;

  const workDir = mkdtempSync(join(tmpdir(), "jht-notion-md-"));
  extractArchive(sourcePath, workDir);

  // Notion 대용량 export는 ZIP 안에 Part-1 ZIP이 한 번 더 들어가는 경우가 많습니다.
  const processed = new Set([sourcePath]);
  for (let depth = 0; depth < 3; depth += 1) {
    const nestedZips = findFiles(workDir, (filePath) => extname(filePath).toLowerCase() === ".zip").filter(
      (filePath) => !processed.has(filePath)
    );
    if (nestedZips.length === 0) break;
    for (const nestedZip of nestedZips) {
      processed.add(nestedZip);
      const destination = join(dirname(nestedZip), `${basename(nestedZip, ".zip")}__extracted`);
      mkdirSync(destination, { recursive: true });
      extractArchive(nestedZip, destination);
    }
  }

  return workDir;
}

function extractArchive(zipPath, destination) {
  try {
    execFileSync("tar", ["-xf", zipPath, "-C", destination], { stdio: "ignore" });
    return;
  } catch {
    if (process.platform !== "win32") throw new Error(`Could not extract ZIP with tar: ${zipPath}`);
  }

  const command = `Expand-Archive -LiteralPath '${escapePowerShellLiteral(zipPath)}' -DestinationPath '${escapePowerShellLiteral(destination)}' -Force`;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", command], { stdio: "ignore" });
}

function findFiles(rootDir, predicate) {
  const results = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(entryPath, predicate));
    } else if (entry.isFile() && predicate(entryPath)) {
      results.push(entryPath);
    }
  }
  return results;
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapePowerShellLiteral(value) {
  return value.replace(/'/g, "''");
}

/**
 * @file 한글 책임 주석 검증기
 * 저장소의 사람이 관리하는 소스 파일마다 경로별 책임을 설명하는 한글 모듈 주석이 있는지
 * 검사합니다. 새 파일이 설명 없이 추가되는 것을 배포 검증 단계에서 차단하며, 자동 생성 파일과
 * 주석 문법을 지원하지 않는 JSON은 명시적으로 검사 대상에서 제외합니다.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supportedExtensions = new Set([".css", ".java", ".mjs", ".sql", ".toml", ".ts", ".tsx"]);
const generatedFiles = new Set(["next-env.d.ts"]);
const marker = "@file 한글 책임";
const koreanPattern = /[가-힣]/;
const executableExtensions = new Set([".java", ".mjs", ".ts", ".tsx"]);

function collectFiles() {
  // Git의 ignore 규칙을 그대로 따라 생성물·캐시를 검사 대상에서 제외하고 실제 리뷰 대상만 확인합니다.
  const gitFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return gitFiles
    .split("\0")
    .filter(Boolean)
    .filter((relativePath) => supportedExtensions.has(path.extname(relativePath).toLowerCase()))
    .map((relativePath) => path.join(repositoryRoot, relativePath));
}

const failures = [];
const candidates = collectFiles();

for (const filePath of candidates) {
  const relativePath = path.relative(repositoryRoot, filePath).split(path.sep).join("/");
  if (generatedFiles.has(relativePath)) continue;

  const source = await readFile(filePath, "utf8");
  const headerWindow = source.slice(0, 1_500);
  if (!headerWindow.includes(marker)) {
    failures.push(`${relativePath}: 파일 상단에 '${marker}' 주석이 없습니다.`);
    continue;
  }
  if (!koreanPattern.test(headerWindow)) {
    failures.push(`${relativePath}: 파일 책임 주석에 한글 설명이 없습니다.`);
  }

  const lines = source.split(/\r?\n/);
  if (executableExtensions.has(path.extname(relativePath).toLowerCase()) && lines.length >= 300) {
    // 긴 모듈은 파일 헤더만으로 로직을 이해하기 어렵기 때문에 주요 처리 구간의 한글 주석도 요구합니다.
    const koreanCommentLineCount = lines.filter(
      (line) => /^\s*(?:\/\/|\/\*|\*)/.test(line) && koreanPattern.test(line),
    ).length;
    if (koreanCommentLineCount < 4) {
      failures.push(`${relativePath}: 300줄 이상 모듈에는 주요 로직을 설명하는 한글 주석이 추가로 필요합니다.`);
    }
  }
}

if (failures.length > 0) {
  console.error("한글 소스 주석 검증 실패:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`한글 소스 주석 검증 통과: ${candidates.length - generatedFiles.size}개 파일`);

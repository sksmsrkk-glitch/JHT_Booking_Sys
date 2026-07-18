/**
 * @file 한글 책임 주석 보강 도구
 * 저장소의 실행 소스, 테스트, 운영 스크립트, Supabase 정의 파일에 경로별 책임을 설명하는
 * 한글 모듈 주석을 추가합니다. 이미 주석이 있는 파일도 파일 전체의 소유 경계를 바로 알 수
 * 있도록 동일한 표식을 사용하며, 반복 실행해도 중복 주석이 생기지 않도록 설계했습니다.
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supportedExtensions = new Set([".css", ".java", ".mjs", ".sql", ".toml", ".ts", ".tsx"]);
const generatedFiles = new Set(["next-env.d.ts"]);
const marker = "@file 한글 책임";

function normalizePath(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

function humanizeName(fileName) {
  return fileName
    .replace(/\.(d\.)?(mjs|ts|tsx|css|sql|toml|java)$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
}

function routeFromPath(relativePath) {
  const route = relativePath
    .replace(/^src\/app/, "")
    .replace(/\/(page|layout|loading|route)\.tsx?$/, "")
    .replace(/\/route\.ts$/, "")
    .replace(/\/(page|layout|loading)\.ts$/, "");
  return route || "/";
}

function describeSource(relativePath) {
  const fileName = path.basename(relativePath);
  const readableName = humanizeName(fileName);

  if (relativePath.startsWith("supabase/migrations/")) {
    const migrationName = humanizeName(fileName.replace(/^\d+_?/, ""));
    return [
      `Supabase 마이그레이션 \`${migrationName}\`의 스키마, 함수, 권한 또는 데이터 무결성 규칙을 순서대로 반영합니다.`,
      "운영 DB와 로컬 DB가 같은 이력을 재현해야 하므로 이미 배포된 구문을 수정하지 않고 후속 마이그레이션으로 변경합니다.",
    ];
  }

  if (relativePath === "supabase/seed.sql") {
    return [
      "로컬 개발과 통합 검증에 필요한 기준 데이터와 업무 시나리오를 재현 가능한 식별자로 구성합니다.",
      "운영 데이터로 오인되지 않도록 호스팅 환경 보호 규칙과 업무 테이블 간 참조 순서를 함께 유지합니다.",
    ];
  }

  if (relativePath === "supabase/config.toml") {
    return [
      "로컬 Supabase 서비스의 포트, 인증, API 및 데이터베이스 실행 조건을 고정합니다.",
      "팀원이 동일한 개발 환경을 재현할 수 있도록 CLI가 읽는 설정값만 관리하며 운영 비밀값은 저장하지 않습니다.",
    ];
  }

  if (relativePath.startsWith("scripts/sql/")) {
    return [
      `\`${readableName}\` SQL 검증 시나리오를 실행해 스키마 권한과 트랜잭션 불변 조건을 확인합니다.`,
      "검증 데이터는 트랜잭션 안에서 만들고 되돌려 실제 운영·개발 데이터를 오염시키지 않는 것을 원칙으로 합니다.",
    ];
  }

  if (relativePath.startsWith("scripts/")) {
    const isVerifier = fileName.startsWith("verify-");
    return isVerifier
      ? [
          `\`${readableName}\` 검증기는 저장소의 코드·스키마·문서 계약이 배포 기준을 지키는지 자동 확인합니다.`,
          "검사 실패는 사람이 놓치기 쉬운 회귀를 CI와 로컬 검증 단계에서 즉시 차단하도록 명확한 종료 코드로 전달합니다.",
        ]
      : [
          `\`${readableName}\` 운영 보조 명령의 입력, 변환 및 실행 절차를 담당합니다.`,
          "반복 실행과 실패 재시도를 고려해 원본 데이터와 비밀값을 훼손하거나 로그로 노출하지 않도록 경계를 유지합니다.",
        ];
  }

  if (relativePath.startsWith("tests/") || relativePath.startsWith("e2e/")) {
    return [
      `\`${readableName}\` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.`,
      "성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.",
    ];
  }

  if (relativePath.startsWith("src/app/api/")) {
    const route = routeFromPath(relativePath);
    return [
      `\`${route}\` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.`,
      "필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.",
    ];
  }

  if (relativePath.startsWith("src/app/")) {
    const route = routeFromPath(relativePath);
    const audience = route.startsWith("/agency")
      ? "해외 파트너"
      : route.startsWith("/admin")
        ? "JHT 내부 운영자"
        : "인증 또는 공용 사용자";
    return [
      `Next.js App Router의 \`${route}\` 화면 또는 라우트 레이아웃을 구성합니다.`,
      `${audience}에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.`,
    ];
  }

  if (relativePath.startsWith("src/components/")) {
    return [
      `\`${readableName}\` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.`,
      "화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.",
    ];
  }

  if (relativePath.match(/^src\/features\/[^/]+\/queries\.ts$/)) {
    const domain = relativePath.split("/")[2];
    return [
      `\`${domain}\` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.`,
      "RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.",
    ];
  }

  if (relativePath.match(/^src\/features\/[^/]+\/types\.ts$/)) {
    const domain = relativePath.split("/")[2];
    return [
      `\`${domain}\` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.`,
      "DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.",
    ];
  }

  if (relativePath.startsWith("src/features/")) {
    const domain = relativePath.split("/")[2];
    return [
      `\`${domain}\` 업무 기능의 입력 정규화, 상태 변환 또는 화면용 데이터를 구성합니다.`,
      "여러 화면과 API가 같은 규칙을 재사용하도록 도메인 결정을 모으고, 공급사 원가와 파트너 공개 데이터의 경계를 유지합니다.",
    ];
  }

  if (relativePath.startsWith("src/lib/domain/") && relativePath.endsWith(".d.ts")) {
    return [
      `\`${readableName}\` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.`,
      "실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.",
    ];
  }

  if (relativePath.startsWith("src/lib/domain/")) {
    return [
      `\`${readableName}\` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.`,
      "API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.",
    ];
  }

  if (relativePath.startsWith("src/lib/api/")) {
    return [
      `\`${readableName}\` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.`,
      "민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.",
    ];
  }

  if (relativePath.startsWith("src/lib/supabase/")) {
    return [
      `\`${readableName}\` Supabase 클라이언트의 실행 환경별 생성과 세션 전달을 담당합니다.`,
      "서버 전용 비밀키와 브라우저 공개키가 섞이지 않도록 클라이언트 경계를 분리하고 요청 단위 인증 정보를 보존합니다.",
    ];
  }

  if (relativePath.startsWith("src/lib/client/")) {
    return [
      `\`${readableName}\` 브라우저에서 공통으로 사용하는 요청·탐색 보조 동작을 제공합니다.`,
      "네트워크 실패와 세션 만료를 예측 가능한 결과로 정규화해 각 폼이 로딩 상태를 반드시 해제할 수 있도록 합니다.",
    ];
  }

  if (relativePath === "src/middleware.ts") {
    return [
      "요청 경로별 인증 여부와 내부 관리자·해외 파트너 포털의 접근 경계를 미들웨어에서 판정합니다.",
      "공개 경로, 로그인 리다이렉트 및 언어 정책을 한곳에서 적용해 페이지마다 권한 규칙이 달라지는 것을 방지합니다.",
    ];
  }

  if (relativePath === "src/app/globals.css") {
    return [
      "관리자와 파트너 포털이 공유하는 색상 토큰, 레이아웃, 입력 높이 및 반응형 화면 규칙을 정의합니다.",
      "페이지별 임시 스타일보다 공통 선택자를 우선해 라이트·다크 모드와 데스크톱·모바일 화면의 시각적 일관성을 유지합니다.",
    ];
  }

  if (relativePath === "next.config.mjs") {
    return [
      "Next.js 빌드와 런타임에 공통 적용할 보안 헤더, 번들 및 배포 동작을 설정합니다.",
      "환경별 차이는 공개 가능한 설정만 사용하며 인증·DB 비밀값은 이 파일에 포함하지 않습니다.",
    ];
  }

  if (relativePath === "playwright.config.ts") {
    return [
      "Playwright 브라우저 테스트의 실행 서버, 브라우저 프로젝트, 재시도 및 결과 보존 정책을 설정합니다.",
      "로컬과 CI에서 같은 사용자 흐름을 재현하되 실패 시 원인을 확인할 수 있는 추적 자료를 남깁니다.",
    ];
  }

  return [
    `\`${readableName}\` 모듈이 담당하는 공통 애플리케이션 규칙과 재사용 가능한 계약을 정의합니다.`,
    "호출 계층이 내부 구현에 직접 의존하지 않도록 입력·출력과 오류 경계를 명확히 유지합니다.",
  ];
}

function formatHeader(extension, descriptions) {
  if (extension === ".sql") {
    return `-- ${marker}: ${descriptions[0]}\n-- ${descriptions[1]}\n\n`;
  }
  if (extension === ".toml") {
    return `# ${marker}: ${descriptions[0]}\n# ${descriptions[1]}\n\n`;
  }
  return `/**\n * ${marker}: ${descriptions[0]}\n * ${descriptions[1]}\n */\n`;
}

function collectFiles() {
  // Git이 추적하거나 커밋 대상으로 인식하는 파일만 다뤄 빌드 산출물과 로컬 도구 캐시를 변경하지 않습니다.
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

const candidates = collectFiles();
let updatedCount = 0;

for (const filePath of candidates.sort()) {
  const relativePath = normalizePath(filePath);
  if (generatedFiles.has(relativePath)) continue;

  const source = await readFile(filePath, "utf8");
  if (source.includes(marker)) continue;

  const extension = path.extname(filePath).toLowerCase();
  const header = formatHeader(extension, describeSource(relativePath));
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  const content = bom ? source.slice(1) : source;

  if (content.startsWith("#!")) {
    const lineEnd = content.indexOf("\n");
    const shebang = lineEnd === -1 ? content : content.slice(0, lineEnd + 1);
    const body = lineEnd === -1 ? "" : content.slice(lineEnd + 1);
    await writeFile(filePath, `${bom}${shebang}${header}${body}`, "utf8");
  } else {
    await writeFile(filePath, `${bom}${header}${content}`, "utf8");
  }
  updatedCount += 1;
}

console.log(`한글 모듈 책임 주석 보강 완료: ${updatedCount}개 파일 수정`);

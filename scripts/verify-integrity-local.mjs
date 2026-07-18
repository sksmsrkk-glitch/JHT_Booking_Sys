/**
 * @file 한글 책임: `verify integrity local` 검증기는 저장소의 코드·스키마·문서 계약이 배포 기준을 지키는지 자동 확인합니다.
 * 검사 실패는 사람이 놓치기 쉬운 회귀를 CI와 로컬 검증 단계에서 즉시 차단하도록 명확한 종료 코드로 전달합니다.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const containerName = "supabase_db_jht-operations-platform";
const sql = readFileSync(new URL("./sql/verify-integrity-local.sql", import.meta.url), "utf8");
const running = spawnSync(
  "docker",
  ["ps", "--filter", `name=^/${containerName}$`, "--format", "{{.Names}}"],
  { encoding: "utf8" }
);

if (running.status !== 0) {
  process.stderr.write(running.stderr || "Docker status check failed.\n");
  process.exit(running.status ?? 1);
}
if (running.stdout.trim() !== containerName) {
  console.error("Local Supabase is not running. Run `npx supabase start` first.");
  process.exit(1);
}

const verification = spawnSync(
  "docker",
  ["exec", "-i", containerName, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { encoding: "utf8", input: sql }
);

if (verification.status !== 0) {
  process.stderr.write(verification.stdout);
  process.stderr.write(verification.stderr);
  process.exit(verification.status ?? 1);
}

console.log("Local integrity verification passed for RPC permissions, atomic partner writes, invoice-scoped payments, full KPI aggregation, and supplier requeue safety.");

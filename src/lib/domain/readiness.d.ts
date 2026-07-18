/**
 * @file 한글 책임: `readiness` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
export type ReadinessEnvCheck = {
  key: string;
  label: string;
  envName: string;
  required: boolean;
  group: string;
  configured: boolean;
  status: "ready" | "missing" | "optional";
};

export type ReadinessWorkflowCheck = {
  key: string;
  label: string;
  route: string;
  group: string;
};

export type ReadinessLaunchCheck = {
  key: string;
  label: string;
  group: string;
  evidence: string;
};

export type ReadinessSmokeCheck = {
  key: string;
  label: string;
  table: string;
  group: string;
  status: "ready" | "failed" | "skipped";
  error: string | null;
};

export type ReadinessStorageCheck = {
  key: string;
  label: string;
  bucketEnvName: string;
  defaultBucket: string;
  bucketName: string;
  group: string;
  status: "ready" | "failed" | "skipped";
  error: string | null;
};

export type ReadinessReport = {
  status: "ready" | "blocked";
  generatedAt: string;
  summary: {
    requiredTotal: number;
    requiredConfigured: number;
    requiredMissing: number;
    optionalMissing: number;
  };
  envChecks: ReadinessEnvCheck[];
  smokeChecks: ReadinessSmokeCheck[];
  storageChecks: ReadinessStorageCheck[];
  smokeSummary?: {
    total: number;
    ready: number;
    failed: number;
    status: "ready" | "blocked";
  };
  storageSummary?: {
    total: number;
    ready: number;
    failed: number;
    status: "ready" | "blocked";
  };
  workflowChecks: ReadinessWorkflowCheck[];
  workflowSummary?: {
    total: number;
    groups: Record<string, number>;
  };
  launchChecks?: ReadinessLaunchCheck[];
  launchSummary?: {
    total: number;
    groups: Record<string, number>;
  };
};

export const READINESS_ENV_CHECKS: Array<Omit<ReadinessEnvCheck, "configured" | "status">>;
export const READINESS_WORKFLOW_CHECKS: ReadinessWorkflowCheck[];
export const READINESS_LAUNCH_CHECKS: ReadinessLaunchCheck[];
export const READINESS_SMOKE_TABLES: Array<Omit<ReadinessSmokeCheck, "status" | "error">>;
export const READINESS_STORAGE_CHECKS: Array<
  Omit<ReadinessStorageCheck, "bucketName" | "status" | "error">
>;
export function buildReadinessReport(env?: Record<string, string | undefined>): ReadinessReport;
export function summarizeReadinessSmokeChecks(results?: ReadinessSmokeCheck[]): {
  total: number;
  ready: number;
  failed: number;
  status: "ready" | "blocked";
};
export function summarizeReadinessWorkflowChecks(results?: ReadinessWorkflowCheck[]): {
  total: number;
  groups: Record<string, number>;
};
export function summarizeReadinessLaunchChecks(results?: ReadinessLaunchCheck[]): {
  total: number;
  groups: Record<string, number>;
};
export function summarizeReadinessStorageChecks(results?: ReadinessStorageCheck[]): {
  total: number;
  ready: number;
  failed: number;
  status: "ready" | "blocked";
};

export type MigrationStatus = "uploaded" | "mapped" | "validated" | "approved" | "imported" | "failed";

export type MigrationValidationRowInput = {
  id: string;
  rowNo?: number;
  row_no?: number;
  rawPayload?: Record<string, unknown>;
  raw_payload?: Record<string, unknown>;
};

export type MigrationValidationError = {
  stagingRowId: string;
  rowNo: number;
  errorCode: string;
  errorMessage: string;
};

export type MigrationValidationResult = {
  status: "validated" | "failed";
  rowCount: number;
  validRowCount: number;
  errorCount: number;
  rows: Array<{
    id: string;
    rowNo: number;
    mappedPayload: Record<string, unknown>;
    validationStatus: "valid" | "invalid";
    errors: MigrationValidationError[];
  }>;
  errors: MigrationValidationError[];
};

export const MIGRATION_STATUSES: MigrationStatus[];
export const MIGRATION_REQUIRED_FIELDS: Record<string, string[]>;

export function validateMigrationRows(input: {
  targetTable: string;
  rows: MigrationValidationRowInput[];
}): MigrationValidationResult;

export function buildMigrationStatusUpdate(input: {
  currentStatus: MigrationStatus;
  nextStatus: MigrationStatus;
  actorProfileId: string;
}, now?: Date): {
  status: MigrationStatus;
  audit: {
    actorProfileId: string;
    action: string;
    riskLevel: "normal" | "high";
    approvalData: { approvedBy: string; approvedAt: string } | null;
  };
};

export function buildMigrationImportRows(input: {
  targetTable: string;
  rows: Array<{
    id?: string;
    rowNo?: number;
    row_no?: number;
    validationStatus?: string;
    validation_status?: string;
    mappedPayload?: Record<string, unknown>;
    mapped_payload?: Record<string, unknown>;
  }>;
}): Record<string, unknown>[];

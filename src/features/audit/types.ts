export type AuditLogListItem = {
  id: string;
  actorProfileId: string | null;
  actorEmail: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  riskLevel: string;
  hasBeforeData: boolean;
  hasAfterData: boolean;
  hasApprovalData: boolean;
  requestId: string | null;
  createdAt: string;
};

export type AuditLogFilters = {
  riskLevel?: string;
  entityTable?: string;
  action?: string;
};

export type ApiLogListItem = {
  id: string;
  source: string;
  endpoint: string | null;
  method: string | null;
  statusCode: number | null;
  idempotencyKey: string | null;
  hasRequestPayload: boolean;
  hasResponsePayload: boolean;
  createdAt: string;
};

export type ApiLogFilters = {
  source?: string;
  endpoint?: string;
  status?: string;
};

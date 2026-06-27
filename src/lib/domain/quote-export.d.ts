export const QUOTE_EXPORT_ACTIVE_STATUSES: string[];
export const QUOTE_EXPORT_BLOCKED_VERSION_STATUSES: string[];

export function buildQuoteExportRequest(input: {
  quoteVersionId: string;
  versionStatus: string;
  publicTotalAmount: number;
  storagePath: string;
}): {
  quote_version_id: string;
  export_type: "xlsx";
  storage_path: string;
  status: "queued";
};

export function buildQuoteExportRetryUpdate(exportRow: {
  id?: string | null;
  status?: string | null;
  storage_path?: string | null;
}): {
  status: "queued";
  error_message: null;
};

export function buildQuoteExportSnapshotSummary(input: {
  quoteCase?: Record<string, any> | null;
  version?: Record<string, any> | null;
}): {
  caseCode: string | null;
  tourName: string | null;
  versionNo: number | null;
  status: string | null;
  currency: string | null;
  publicTotalAmount: number;
  itineraryDayCount: number;
  routeSegmentCount: number;
  itemCount: number;
};

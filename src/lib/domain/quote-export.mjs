export const QUOTE_EXPORT_ACTIVE_STATUSES = ["queued", "processing"];
export const QUOTE_EXPORT_BLOCKED_VERSION_STATUSES = ["cancelled", "expired"];

export function buildQuoteExportRequest({ quoteVersionId, versionStatus, publicTotalAmount, storagePath }) {
  if (!quoteVersionId) {
    throw new Error("quoteVersionId is required");
  }
  if (QUOTE_EXPORT_BLOCKED_VERSION_STATUSES.includes(versionStatus)) {
    throw new Error(`Quote version export is locked when status is ${versionStatus}`);
  }
  if (Number(publicTotalAmount ?? 0) <= 0) {
    throw new Error("Quote version must have a public total before export");
  }
  if (!storagePath || !storagePath.endsWith(".xlsx")) {
    throw new Error("storagePath must point to an .xlsx file");
  }

  return {
    quote_version_id: quoteVersionId,
    export_type: "xlsx",
    storage_path: storagePath,
    status: "queued"
  };
}

export function buildQuoteExportRetryUpdate(exportRow) {
  if (!exportRow?.id) {
    throw new Error("export.id is required");
  }
  if (exportRow.status !== "failed") {
    throw new Error(`Only failed quote exports can be retried, got ${exportRow.status}`);
  }
  if (!exportRow.storage_path || !String(exportRow.storage_path).endsWith(".xlsx")) {
    throw new Error("Failed quote export must have an .xlsx storage path before retry");
  }

  return {
    status: "queued",
    error_message: null
  };
}

export function buildQuoteExportSnapshotSummary({ quoteCase, version }) {
  const itineraryDays = Array.isArray(version?.itineraryDays) ? version.itineraryDays : [];
  const items = Array.isArray(version?.items) ? version.items : [];
  const routeSegmentCount = itineraryDays.reduce(
    (count, day) => count + (Array.isArray(day.routeSegments) ? day.routeSegments.length : 0),
    0
  );

  return {
    caseCode: quoteCase?.caseCode ?? null,
    tourName: quoteCase?.tourName ?? null,
    versionNo: version?.versionNo ?? null,
    status: version?.status ?? null,
    currency: version?.currency ?? quoteCase?.currency ?? null,
    publicTotalAmount: Number(version?.publicTotalAmount ?? 0),
    itineraryDayCount: itineraryDays.length,
    routeSegmentCount,
    itemCount: items.length
  };
}

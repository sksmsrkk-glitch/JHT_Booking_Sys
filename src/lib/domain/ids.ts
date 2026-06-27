export function makeCaseCode(prefix = "JHT") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function makeReservationCode(prefix = "RSV") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function makeInvoiceNo(prefix = "INV") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function makeShareId() {
  return `qc_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function makeExportPath(quoteVersionId: string) {
  return `quote-exports/${quoteVersionId}/${crypto.randomUUID()}.xlsx`;
}

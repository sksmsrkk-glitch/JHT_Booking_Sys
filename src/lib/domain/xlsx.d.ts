export function buildQuoteExportWorkbook(input: {
  summary: Record<string, any>;
  itineraryDays?: Array<Record<string, any>>;
  items?: Array<Record<string, any>>;
}): Buffer;

export function createXlsxBuffer(rows: unknown[][]): Buffer;

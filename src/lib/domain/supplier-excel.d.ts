export const SUPPLIER_EXCEL_SHEET_NAME: string;
export const SUPPLIER_EXCEL_COLUMNS: string[][];

export function buildSupplierTemplateWorkbook(): Buffer;
export function buildSupplierExportWorkbook(rows: Record<string, unknown>[]): Buffer;
export function parseSupplierWorkbook(buffer: ArrayBuffer | Buffer): Record<string, unknown>[];
export function supplierRowsFromDatabase(suppliers: unknown[]): Record<string, unknown>[];
export function mediaItemsFromSupplierExcelRow(row: Record<string, unknown>): Array<{
  storagePath: string;
  imageUrl: string;
  publicLabel: string;
  altText: string;
  sortOrder: number;
}>;
export function clean(value: unknown): string;

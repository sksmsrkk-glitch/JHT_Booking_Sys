/**
 * @file 한글 책임: `supplier excel` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
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

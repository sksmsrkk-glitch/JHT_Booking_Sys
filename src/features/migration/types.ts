export type MigrationBatchListItem = {
  id: string;
  sourceName: string;
  sourceKind: string;
  targetTable: string;
  status: string;
  rowCount: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MigrationFilters = {
  status?: string;
  targetTable?: string;
};

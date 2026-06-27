export type OperationTaskListItem = {
  id: string;
  reservationId: string;
  reservationCode: string | null;
  agencyName: string | null;
  tourName: string | null;
  team: string;
  taskType: string;
  title: string;
  status: string;
  dueAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  domesticSupplierId: string | null;
  domesticSupplierName: string | null;
  reminderCount: number;
  createdAt: string;
};

export type OperationTaskFilters = {
  team?: string;
  status?: string;
  q?: string;
};

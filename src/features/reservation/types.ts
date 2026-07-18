/**
 * @file 한글 책임: `reservation` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type ReservationListItem = {
  id: string;
  reservationCode: string;
  status: string;
  tourStartDate: string | null;
  tourEndDate: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  agencyAccountId: string;
  agencyName: string | null;
  quoteCaseId: string;
  caseCode: string | null;
  tourName: string | null;
  estimatedPax: number | null;
  operationTaskSummary: ReservationOperationTaskSummary[];
  taskCount: number;
  roomingListCount: number;
  operationReady?: boolean;
  operationMissing?: string[];
  createdAt: string;
};

export type ReservationSummaryRow = {
  label: string;
  groups: number;
  pax: number;
};

export type ReservationDashboardData = {
  metrics: {
    totalGroups: number;
    activeGroups: number;
    totalPax: number;
    incompleteGroups: number;
    unscheduledGroups: number;
  };
  summaries: {
    monthly: ReservationSummaryRow[];
    weekly: ReservationSummaryRow[];
    yearly: ReservationSummaryRow[];
    partner: ReservationSummaryRow[];
    country: ReservationSummaryRow[];
  };
};

export type ReservationOperationTaskSummary = {
  id: string;
  team: string;
  taskType: string;
  status: string;
};

export type ReservationDetail = ReservationListItem & {
  acceptedQuoteVersionId: string | null;
  acceptedQuoteVersion: ReservationAcceptedQuoteVersion | null;
  quoteItems: ReservationQuoteItem[];
  supplierMessages: ReservationSupplierMessageItem[];
  statusHistory: ReservationStatusHistoryItem[];
  operationTasks: ReservationOperationTaskItem[];
  roomingLists: ReservationRoomingListItem[];
  passengers: ReservationPassengerItem[];
  roomAssignments: ReservationRoomAssignmentItem[];
  supplierOptions: ReservationSupplierOption[];
};

export type ReservationAcceptedQuoteVersion = {
  id: string;
  versionNo: number;
  status: string;
  currency: string;
  publicTotalAmount: number;
  acceptedAt: string | null;
};

export type ReservationQuoteItem = {
  id: string;
  itemCategory: string;
  serviceSection: string | null;
  snapshotItemName: string;
  snapshotSupplierName: string | null;
  pricingUnit: string;
  quantity: number;
  paxCount: number | null;
  totalCostKrw: number;
  totalSellAmount: number;
  partnerVisibleNotes: string | null;
  internalNotes: string | null;
};

export type ReservationSupplierMessageItem = {
  id: string;
  domesticSupplierId: string;
  domesticSupplierName: string | null;
  messageType: string;
  status: string;
  subject: string | null;
  approvedAt: string | null;
  secondApprovedAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type ReservationStatusHistoryItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
};

export type ReservationOperationTaskItem = {
  id: string;
  team: string;
  taskType: string;
  title: string;
  status: string;
  dueAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  domesticSupplierId: string | null;
  domesticSupplierName: string | null;
};

export type ReservationRoomingListItem = {
  id: string;
  originalFilename: string | null;
  storagePath: string | null;
  revisionNo: number;
  parsedStatus: string;
  createdAt: string;
};

export type ReservationPassengerItem = {
  id: string;
  passengerNo: string | null;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  dietaryRequirements: string | null;
  passportNo: string | null;
  coachLabel: string | null;
  roomingListId: string | null;
  createdAt: string;
};

export type ReservationRoomAssignmentItem = {
  id: string;
  roomNo: string | null;
  roomType: string;
  passengerIds: string[];
  passengerNames: string[];
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
  roomingListId: string | null;
  createdAt: string;
};

export type ReservationSupplierOption = {
  id: string;
  nameKo: string;
  contacts: ReservationSupplierContactOption[];
};

export type ReservationSupplierContactOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type ReservationFilters = {
  q?: string;
  status?: string;
  agencyAccountId?: string;
};

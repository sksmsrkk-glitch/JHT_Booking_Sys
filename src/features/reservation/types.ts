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
  taskCount: number;
  roomingListCount: number;
  createdAt: string;
};

export type ReservationDetail = ReservationListItem & {
  acceptedQuoteVersionId: string | null;
  statusHistory: ReservationStatusHistoryItem[];
  operationTasks: ReservationOperationTaskItem[];
  roomingLists: ReservationRoomingListItem[];
  passengers: ReservationPassengerItem[];
  roomAssignments: ReservationRoomAssignmentItem[];
  supplierOptions: ReservationSupplierOption[];
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

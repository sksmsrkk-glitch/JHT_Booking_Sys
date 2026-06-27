export type AgencyQuoteListItem = {
  id: string;
  caseCode: string;
  shareId: string;
  tourName: string;
  tourType: string | null;
  status: string;
  currency: string;
  estimatedPax: number | null;
  startDate: string | null;
  endDate: string | null;
  latestVersionNo: number | null;
  latestVersionStatus: string | null;
  publicTotalAmount: number | null;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

export type AgencyQuoteDetail = {
  id: string;
  caseCode: string;
  shareId: string;
  tourName: string;
  tourType: string | null;
  status: string;
  currency: string;
  estimatedPax: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  versions: AgencyQuoteVersionDetail[];
  requestTimeline: AgencyQuoteRequestTimelineItem[];
};

export type AgencyQuoteRequestTimelineItem = {
  id: string;
  inquiryType: string;
  title: string;
  status: string;
  requestPayload: Record<string, unknown>;
  createdAt: string;
};

export type AgencyQuoteVersionDetail = {
  id: string;
  versionNo: number;
  status: string;
  currency: string;
  agencyVisibleSummary: Record<string, unknown>;
  publicFareOptions: Record<string, unknown>[];
  publicTotalAmount: number;
  termsAndConditions: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  itineraryDays: AgencyQuoteItineraryDay[];
  presentationBlocks: AgencyQuotePresentationBlock[];
};

export type AgencyQuoteItineraryDay = {
  id: string;
  dayNo: number;
  serviceDate: string | null;
  title: string | null;
  mealSummary: Record<string, unknown>;
  publicDescription: string | null;
  routeSegments: AgencyRouteSegment[];
  presentationBlocks: AgencyQuotePresentationBlock[];
};

export type AgencyQuotePresentationBlock = {
  id: string;
  quoteItineraryDayId: string | null;
  blockType: string;
  displayContext: string;
  title: string | null;
  description: string | null;
  imageStoragePath: string | null;
  imageUrl: string | null;
  altText: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type AgencyRouteSegment = {
  id: string;
  seq: number;
  originLabel: string;
  destinationLabel: string;
  travelMinutes: number | null;
  distanceMeters: number | null;
  provider: string;
};

export type AgencyReservationListItem = {
  id: string;
  reservationCode: string;
  status: string;
  tourStartDate: string | null;
  tourEndDate: string | null;
  quoteCaseId: string;
  caseCode: string | null;
  tourName: string | null;
  statusHistoryCount: number;
  roomingListCount: number;
  createdAt: string;
};

export type AgencyReservationDetail = AgencyReservationListItem & {
  statusHistory: AgencyReservationStatusHistoryItem[];
  roomingLists: AgencyRoomingListItem[];
  passengers: AgencyPassengerItem[];
};

export type AgencyReservationStatusHistoryItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
};

export type AgencyRoomingListItem = {
  id: string;
  originalFilename: string | null;
  storagePath: string | null;
  revisionNo: number;
  parsedStatus: string;
  createdAt: string;
};

export type AgencyPassengerItem = {
  id: string;
  passengerNo: string | null;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  dietaryRequirements: string | null;
  coachLabel: string | null;
  roomingListId: string | null;
  createdAt: string;
};

export type AgencyInvoiceListItem = {
  id: string;
  invoiceNo: string;
  reservationId: string;
  reservationCode: string | null;
  agencyName: string | null;
  tourName: string | null;
  status: string;
  currency: string;
  totalAmount: number;
  issuedAt: string | null;
  dueDate: string | null;
  storagePath: string | null;
  confirmedPaymentTotal: number;
  paymentCount: number;
  createdAt: string;
};

export type AgencyInvoiceDetail = AgencyInvoiceListItem & {
  payments: AgencyPaymentSummary[];
};

export type AgencyPaymentSummary = {
  id: string;
  status: string;
  currency: string;
  amount: number;
  receivedAt: string | null;
  method: string | null;
  createdAt: string;
};

/**
 * @file 한글 책임: `quotation` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type QuoteCaseListItem = {
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
  agencyAccountId: string;
  agencyName: string | null;
  versionCount: number;
  latestVersionStatus: string | null;
  publicTotalAmount: number | null;
  createdAt: string;
};

export type QuoteCaseDetail = QuoteCaseListItem & {
  versions: QuoteVersionDetail[];
  requestTimeline: QuoteRequestTimelineItem[];
};

export type QuoteRequestTimelineItem = {
  id: string;
  inquiryType: string;
  title: string;
  status: string;
  sourceChannel: string;
  requestPayload: Record<string, unknown>;
  createdAt: string;
};

export type QuoteVersionDetail = {
  id: string;
  versionNo: number;
  status: string;
  marginMode: string;
  defaultMarginRate: number;
  currency: string;
  exchangeRateToKrw: number;
  agencyVisibleSummary: Record<string, unknown>;
  publicFareOptions: Record<string, unknown>[];
  excelSourceSummary: Record<string, unknown>;
  publicTotalAmount: number;
  internalTotalCostKrw: number;
  internalTotalMarginKrw: number;
  termsAndConditions: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  itineraryDays: QuoteItineraryDayDetail[];
  items: QuoteItemDetail[];
  exports: QuoteExportDetail[];
  presentationBlocks: QuotePresentationBlockDetail[];
};

export type QuoteExportDetail = {
  id: string;
  exportType: string;
  storagePath: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export type QuoteItineraryDayDetail = {
  id: string;
  dayNo: number;
  serviceDate: string | null;
  title: string | null;
  publicDescription: string | null;
  internalNotes: string | null;
  routeSegments: QuoteRouteSegmentDetail[];
  presentationBlocks: QuotePresentationBlockDetail[];
};

export type QuotePresentationBlockDetail = {
  id: string;
  quoteItineraryDayId: string | null;
  sourceSupplierMediaId: string | null;
  blockType: string;
  displayContext: string;
  title: string | null;
  description: string | null;
  imageStoragePath: string | null;
  imageUrl: string | null;
  altText: string | null;
  sortOrder: number;
  isPublic: boolean;
  metadata: Record<string, unknown>;
};

export type QuoteRouteSegmentDetail = {
  id: string;
  seq: number;
  originLabel: string;
  destinationLabel: string;
  travelMinutes: number | null;
  distanceMeters: number | null;
  provider: string;
  manualOverride: boolean;
};

export type QuoteItemDetail = {
  id: string;
  itemCategory: string;
  snapshotItemName: string;
  snapshotSupplierName: string | null;
  snapshotCostCurrency: string;
  snapshotUnitCostAmount: number;
  exchangeRateToKrw: number;
  pricingUnit: string;
  quantity: number;
  paxCount: number | null;
  marginMode: string;
  marginRate: number | null;
  manualMarginAmount: number | null;
  totalCostKrw: number;
  totalSellAmount: number;
  partnerVisibleNotes: string | null;
  internalNotes: string | null;
  serviceSection: string;
  calculationMode: string;
  excelCellRef: string | null;
  excelFormula: string | null;
  manualOverride: boolean;
  supplierCostBreakdown: Record<string, unknown>;
  publicBreakdown: Record<string, unknown>;
};

export type QuoteCaseFilters = {
  q?: string;
  status?: string;
  agencyAccountId?: string;
};

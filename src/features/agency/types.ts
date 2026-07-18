/**
 * @file 한글 책임: `agency` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type AgencyRecordStatus = "active" | "inactive" | "archived";
export type AgencyLifecycleStatus = "pending_approval" | "active" | "frozen" | "withdrawn" | "rejected";
export type AgencyApplicationStatus = "pending" | "approved" | "rejected";

export type AgencyListItem = {
  id: string;
  name: string;
  countryCode: string | null;
  emailDomain: string | null;
  billingCurrency: string;
  phone: string | null;
  website: string | null;
  status: AgencyRecordStatus;
  lifecycleStatus: AgencyLifecycleStatus;
  contactCount: number;
  userCount: number;
  inquiryCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  updatedAt: string;
};

export type AgencyContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  receivesQuotes: boolean;
  receivesInvoices: boolean;
  notes: string | null;
  status: AgencyRecordStatus;
};

export type AgencyUserSummary = {
  id: string;
  authUserId: string | null;
  email: string;
  name: string;
  title: string | null;
  isAccountAdmin: boolean;
  accountRole: "mother" | "sub_account";
  parentAgencyUserId: string | null;
  passwordResetRequired: boolean;
  lastLoginAt: string | null;
  status: AgencyRecordStatus;
};

export type AgencyInquirySummary = {
  id: string;
  inquiryType: string;
  title: string;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  paxCount: number | null;
  tourType: string | null;
  status: string;
  createdAt: string;
};

export type AgencyDetail = AgencyListItem & {
  googleDriveFolderUrl: string | null;
  contacts: AgencyContact[];
  users: AgencyUserSummary[];
  inquiries: AgencyInquirySummary[];
  emailEvents: AgencyEmailEvent[];
  loginEvents: AgencyLoginEvent[];
};

export type AgencyListFilters = {
  q?: string;
  status?: string;
  country?: string;
};

export type AgencySignupApplication = {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  email: string;
  countryCode: string;
  countryName: string | null;
  originalCountryName: string | null;
  requestedBillingCurrency: string | null;
  website: string | null;
  notes: string | null;
  status: AgencyApplicationStatus;
  rejectionReason: string | null;
  createdAgencyAccountId: string | null;
  createdMotherAgencyUserId: string | null;
  emailNotificationStatus: string;
  createdAt: string;
  reviewedAt: string | null;
};

export type AgencyEmailEvent = {
  id: string;
  eventType: string;
  recipientEmail: string;
  subject: string;
  deliveryStatus: string;
  createdAt: string;
  sentAt: string | null;
};

export type AgencyLoginEvent = {
  id: string;
  agencyUserId: string | null;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

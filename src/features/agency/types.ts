export type AgencyRecordStatus = "active" | "inactive" | "archived";

export type AgencyListItem = {
  id: string;
  name: string;
  countryCode: string | null;
  emailDomain: string | null;
  billingCurrency: string;
  phone: string | null;
  website: string | null;
  status: AgencyRecordStatus;
  contactCount: number;
  userCount: number;
  inquiryCount: number;
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
};

export type AgencyListFilters = {
  q?: string;
  status?: string;
  country?: string;
};

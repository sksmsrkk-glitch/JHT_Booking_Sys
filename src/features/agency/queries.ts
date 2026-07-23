/**
 * @file 한글 책임: `agency` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import { applySearch } from "@/lib/search.mjs";
import type {
  AgencyDetail,
  AgencySignupApplication,
  AgencyInquirySummary,
  AgencyListFilters,
  AgencyListItem,
  AgencyRecordStatus
} from "./types";
import {
  buildPaginationMeta,
  paginationRange,
  type PaginatedResult,
  type PaginationInput
} from "@/lib/api/pagination";

type SupabaseClientLike = {
  from: (table: string) => any;
};

const agencyListColumns =
  "id, name, country_code, email_domain, billing_currency, phone, website, status, lifecycle_status, created_at, updated_at, last_login_at, agency_contacts(id), agency_users(id), agency_inquiries(id)";

export const AGENCY_RECORD_STATUSES: AgencyRecordStatus[] = ["active", "inactive", "archived"];

export async function listAgencyAccounts(
  supabase: SupabaseClientLike,
  filters: AgencyListFilters = {}
): Promise<AgencyListItem[]> {
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, AGENCY_RECORD_STATUSES) ?? "active";
  const country = normalizeCode(filters.country);

  let query = supabase
    .from("agency_accounts")
    .select(agencyListColumns)
    .eq("status", status)
    .limit(100);

  query = applySearch(query, q, ["name", "email_domain", "country_code"]);

  if (country) {
    query = query.eq("country_code", country);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapAgencyListItem);
}

export async function listAgencyAccountPage(
  supabase: SupabaseClientLike,
  filters: AgencyListFilters,
  pagination: PaginationInput
): Promise<PaginatedResult<AgencyListItem>> {
  const q = normalizeSearchTerm(filters.q);
  const status = normalizeEnum(filters.status, AGENCY_RECORD_STATUSES) ?? "active";
  const country = normalizeCode(filters.country);
  const { from, to } = paginationRange(pagination);

  let query = supabase
    .from("agency_accounts")
    .select(agencyListColumns, { count: "exact" })
    .eq("status", status)
    .order("name", { ascending: true })
    .range(from, to);

  query = applySearch(query, q, ["name", "email_domain", "country_code"]);
  if (country) query = query.eq("country_code", country);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapAgencyListItem);
  return { items, pagination: buildPaginationMeta(pagination, count, items.length) };
}

export async function getAgencyAccountDetail(
  supabase: SupabaseClientLike,
  agencyAccountId: string
): Promise<AgencyDetail | null> {
  const { data, error } = await supabase
    .from("agency_accounts")
    .select(
      "id, name, country_code, email_domain, billing_currency, phone, website, google_drive_folder_url, status, lifecycle_status, created_at, updated_at, last_login_at, agency_contacts(id, name, email, phone, role, receives_quotes, receives_invoices, notes, status), agency_users(id, auth_user_id, email, name, title, is_account_admin, account_role, parent_agency_user_id, password_reset_required, last_login_at, status), agency_inquiries(id, inquiry_type, title, requested_start_date, requested_end_date, pax_count, tour_type, status, created_at), agency_account_email_events(id, event_type, recipient_email, subject, delivery_status, created_at, sent_at), agency_login_events(id, agency_user_id, event_type, ip_address, user_agent, created_at)"
    )
    .eq("id", agencyAccountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const listItem = mapAgencyListItem(data);
  const inquiries = [...((data.agency_inquiries ?? []) as any[])]
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, 20)
    .map(mapAgencyInquirySummary);

  return {
    ...listItem,
    googleDriveFolderUrl: data.google_drive_folder_url ?? null,
    contacts: (data.agency_contacts ?? []).map((contact: any) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      role: contact.role ?? null,
      receivesQuotes: Boolean(contact.receives_quotes),
      receivesInvoices: Boolean(contact.receives_invoices),
      notes: contact.notes ?? null,
      status: contact.status
    })),
    users: (data.agency_users ?? []).map((user: any) => ({
      id: user.id,
      authUserId: user.auth_user_id ?? null,
      email: user.email,
      name: user.name,
      title: user.title ?? null,
      isAccountAdmin: Boolean(user.is_account_admin),
      accountRole: user.account_role ?? (user.is_account_admin ? "mother" : "sub_account"),
      parentAgencyUserId: user.parent_agency_user_id ?? null,
      passwordResetRequired: Boolean(user.password_reset_required),
      lastLoginAt: user.last_login_at ?? null,
      status: user.status
    })),
    inquiries,
    emailEvents: (data.agency_account_email_events ?? [])
      .map((event: any) => ({
        id: event.id,
        eventType: event.event_type,
        recipientEmail: event.recipient_email,
        subject: event.subject,
        deliveryStatus: event.delivery_status,
        createdAt: event.created_at,
        sentAt: event.sent_at ?? null
      }))
      .sort((left: any, right: any) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, 20),
    loginEvents: (data.agency_login_events ?? [])
      .map((event: any) => ({
        id: event.id,
        agencyUserId: event.agency_user_id ?? null,
        eventType: event.event_type,
        ipAddress: event.ip_address ?? null,
        userAgent: event.user_agent ?? null,
        createdAt: event.created_at
      }))
      .sort((left: any, right: any) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, 20)
  };
}

export async function listAgencySignupApplications(
  supabase: SupabaseClientLike,
  status = "pending"
): Promise<AgencySignupApplication[]> {
  let query = supabase
    .from("agency_signup_applications")
    .select(
      "id, company_name, contact_name, phone, email, country_code, country_name, original_country_name, requested_billing_currency, website, notes, status, rejection_reason, created_agency_account_id, created_mother_agency_user_id, email_notification_status, created_at, reviewed_at"
    )
    .limit(100);

  if (["pending", "approved", "rejected"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name ?? null,
    phone: row.phone ?? null,
    email: row.email,
    countryCode: row.country_code,
    countryName: row.country_name ?? null,
    originalCountryName: row.original_country_name ?? row.country_name ?? null,
    requestedBillingCurrency: row.requested_billing_currency ?? null,
    website: row.website ?? null,
    notes: row.notes ?? null,
    status: row.status,
    rejectionReason: row.rejection_reason ?? null,
    createdAgencyAccountId: row.created_agency_account_id ?? null,
    createdMotherAgencyUserId: row.created_mother_agency_user_id ?? null,
    emailNotificationStatus: row.email_notification_status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null
  }));
}

export function mapAgencyInquirySummary(row: any): AgencyInquirySummary {
  return {
    id: row.id,
    inquiryType: row.inquiry_type,
    title: row.title,
    requestedStartDate: row.requested_start_date ?? null,
    requestedEndDate: row.requested_end_date ?? null,
    paxCount: row.pax_count ?? null,
    tourType: row.tour_type ?? null,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapAgencyListItem(row: any): AgencyListItem {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.country_code ?? null,
    emailDomain: row.email_domain ?? null,
    billingCurrency: row.billing_currency,
    phone: row.phone ?? null,
    website: row.website ?? null,
    status: row.status,
    lifecycleStatus: row.lifecycle_status ?? (row.status === "active" ? "active" : "withdrawn"),
    contactCount: Array.isArray(row.agency_contacts) ? row.agency_contacts.length : 0,
    userCount: Array.isArray(row.agency_users) ? row.agency_users.length : 0,
    inquiryCount: Array.isArray(row.agency_inquiries) ? row.agency_inquiries.length : 0,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
    updatedAt: row.updated_at
  };
}

function normalizeSearchTerm(value: string | undefined) {
  // 트림과 길이 상한만 적용합니다. LIKE 이스케이프·토큰 분리는 applySearch가 처리합니다.
  if (!value) return "";
  return value.trim().slice(0, 80);
}

function normalizeCode(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 12).toUpperCase();
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

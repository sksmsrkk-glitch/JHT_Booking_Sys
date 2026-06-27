import type {
  AgencyDetail,
  AgencyInquirySummary,
  AgencyListFilters,
  AgencyListItem,
  AgencyRecordStatus
} from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

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
    .select(
      "id, name, country_code, email_domain, billing_currency, phone, website, status, updated_at, agency_contacts(id), agency_users(id), agency_inquiries(id)"
    )
    .eq("status", status)
    .limit(100);

  if (q) {
    query = query.or(`name.ilike.%${q}%,email_domain.ilike.%${q}%,country_code.ilike.%${q}%`);
  }

  if (country) {
    query = query.eq("country_code", country);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapAgencyListItem);
}

export async function getAgencyAccountDetail(
  supabase: SupabaseClientLike,
  agencyAccountId: string
): Promise<AgencyDetail | null> {
  const { data, error } = await supabase
    .from("agency_accounts")
    .select(
      "id, name, country_code, email_domain, billing_currency, phone, website, google_drive_folder_url, status, updated_at, agency_contacts(id, name, email, phone, role, receives_quotes, receives_invoices, notes, status), agency_users(id, auth_user_id, email, name, title, is_account_admin, status), agency_inquiries(id, inquiry_type, title, requested_start_date, requested_end_date, pax_count, tour_type, status, created_at)"
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
      status: user.status
    })),
    inquiries
  };
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
    contactCount: Array.isArray(row.agency_contacts) ? row.agency_contacts.length : 0,
    userCount: Array.isArray(row.agency_users) ? row.agency_users.length : 0,
    inquiryCount: Array.isArray(row.agency_inquiries) ? row.agency_inquiries.length : 0,
    updatedAt: row.updated_at
  };
}

function normalizeSearchTerm(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[,%]/g, " ").slice(0, 80);
}

function normalizeCode(value: string | undefined) {
  if (!value) return "";
  return value.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 12).toUpperCase();
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

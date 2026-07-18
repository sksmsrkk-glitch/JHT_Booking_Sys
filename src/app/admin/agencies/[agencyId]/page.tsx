/**
 * @file 한글 책임: Next.js App Router의 `/admin/agencies/[agencyId]` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AgencyContactCreateForm, AgencyUserCreateForm } from "@/components/admin/AgencyPeopleForms";
import { AgencyLifecycleActions, AgencyUserGovernanceActions } from "@/components/admin/AgencyGovernanceActions";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyDetail } from "@/features/agency/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ agencyId: string }>;
};

type LoadState =
  | { status: "ready"; agency: AgencyDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

const agenciesRoute = "/admin/agencies" as Route;

/**
 * 한 해외 파트너사의 회사 정보, 담당자, mother/sub 계정 및 상태 변경 이력을 함께 조회합니다.
 * 계정 관리 액션은 UI에서 직접 Auth를 변경하지 않고 승인된 내부 API를 통해 감사 로그와 함께 수행합니다.
 */
export default async function AdminAgencyDetailPage({ params }: PageProps) {
  const { agencyId } = await params;
  const loadState = await loadAgency(agencyId);

  if (loadState.status === "not-found") {
    notFound();
  }

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Overseas Agency</p>
            <h1>{loadState.status === "auth-required" ? "Internal role required" : "Agency data could not load"}</h1>
            <p>{loadState.message}</p>
          </div>
          <Link className="button-secondary" href={agenciesRoute}>
            Back to Agencies
          </Link>
        </div>
      </>
    );
  }

  const agency = loadState.agency;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency</p>
          <h1>{agency.name}</h1>
          <p>
            {agency.countryCode ?? "Country not set"} / {agency.billingCurrency}
          </p>
        </div>
        <Link className="button-secondary" href={agenciesRoute}>
          Back to Agencies
        </Link>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Agency Profile</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>
                {formatLabel(agency.status)} / {formatLabel(agency.lifecycleStatus)}
              </dd>
            </div>
            <div>
              <dt>Governance</dt>
              <dd>
                <AgencyLifecycleActions agencyId={agency.id} lifecycleStatus={agency.lifecycleStatus} />
              </dd>
            </div>
            <div>
              <dt>Email Domain</dt>
              <dd>{agency.emailDomain ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{agency.phone ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>{agency.website ?? "Not set"}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Workspace Links</h2>
          <dl className="definition-list">
            <div>
              <dt>Google Drive Folder</dt>
              <dd>{agency.googleDriveFolderUrl ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Contacts</dt>
              <dd>{agency.contactCount}</dd>
            </div>
            <div>
              <dt>Portal Users</dt>
              <dd>{agency.userCount}</dd>
            </div>
            <div>
              <dt>Inquiries</dt>
              <dd>{agency.inquiryCount}</dd>
            </div>
            <div>
              <dt>Signup / Last Login</dt>
              <dd>
                {formatDateTime(agency.createdAt)} / {agency.lastLoginAt ? formatDateTime(agency.lastLoginAt) : "No log"}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Contacts</h2>
          <span>{agency.contacts.length} records</span>
        </div>
        <section className="panel-section">
          <h2>Add Contact</h2>
          <AgencyContactCreateForm agencyId={agency.id} />
        </section>
        <SimpleTable
          emptyText="No agency contacts are registered."
          headers={["Name", "Role", "Email", "Phone", "Quotes", "Invoices", "Notes"]}
          rows={agency.contacts.map((contact) => [
            contact.name,
            contact.role ?? "Not set",
            contact.email ?? "Not set",
            contact.phone ?? "Not set",
            contact.receivesQuotes ? "Receives" : "No",
            contact.receivesInvoices ? "Receives" : "No",
            contact.notes ?? "None"
          ])}
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Portal Users</h2>
          <span>{agency.users.length} records</span>
        </div>
        <section className="panel-section">
          <h2>Add Portal User</h2>
          <AgencyUserCreateForm agencyId={agency.id} />
        </section>
        <SimpleTable
          emptyText="No agency portal users are registered."
          headers={["Name", "Email", "Role", "Auth / PW", "Last Login", "Status", "Action"]}
          rows={agency.users.map((user) => [
            user.name,
            user.email,
            `${formatLabel(user.accountRole)}${user.title ? ` / ${user.title}` : ""}`,
            `${user.authUserId ? "Linked" : "Pending"} / ${user.passwordResetRequired ? "Reset required" : "PW set"}`,
            user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "No log",
            formatLabel(user.status),
            <AgencyUserGovernanceActions key={user.id} agencyId={agency.id} userId={user.id} />
          ])}
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Recent Inquiries</h2>
          <span>{agency.inquiries.length} shown</span>
        </div>
        <SimpleTable
          emptyText="No agency inquiries are registered."
          headers={["Title", "Type", "Dates", "Pax", "Tour Type", "Status"]}
          rows={agency.inquiries.map((inquiry) => [
            inquiry.title,
            formatLabel(inquiry.inquiryType),
            formatDateRange(inquiry.requestedStartDate, inquiry.requestedEndDate),
            inquiry.paxCount?.toString() ?? "Not set",
            inquiry.tourType ? formatLabel(inquiry.tourType) : "Not set",
            inquiry.status
          ])}
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Account Email Events</h2>
          <span>{agency.emailEvents.length} shown</span>
        </div>
        <SimpleTable
          emptyText="No account email events are queued."
          headers={["Event", "Recipient", "Subject", "Delivery", "Created"]}
          rows={agency.emailEvents.map((event) => [
            formatLabel(event.eventType),
            event.recipientEmail,
            event.subject,
            formatLabel(event.deliveryStatus),
            formatDateTime(event.createdAt)
          ])}
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Login Log</h2>
          <span>{agency.loginEvents.length} shown</span>
        </div>
        <SimpleTable
          emptyText="No partner login records are available."
          headers={["Event", "User", "IP", "User Agent", "Created"]}
          rows={agency.loginEvents.map((event) => [
            formatLabel(event.eventType),
            event.agencyUserId ?? "Unknown",
            event.ipAddress ?? "Not captured",
            event.userAgent ?? "Not captured",
            formatDateTime(event.createdAt)
          ])}
        />
      </section>

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>This Admin page reads `agency_*` customer records only.</li>
          <li>Domestic Supplier prices, quote item internals, expenses, and settlements are not part of this view.</li>
          <li>Agency Portal access must remain scoped by active agency user membership.</li>
        </ul>
      </section>
    </>
  );
}

function SimpleTable({
  headers,
  rows,
  emptyText
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty-state compact">
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function loadAgency(agencyId: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads agency customer data through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl(`/api/agencies/${agencyId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (response.status === 404) return { status: "not-found" };

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown agency API error"
    };
  }

  return { status: "ready", agency: payload.data };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Not set";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value));
}

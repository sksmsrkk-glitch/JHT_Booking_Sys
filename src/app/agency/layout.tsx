import type { ReactNode } from "react";
import { PartnerWorkspaceShell } from "@/components/agency/PartnerWorkspaceShell";
import { getPageAuthorization } from "@/lib/api/page-session";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const { authorization } = await getPageAuthorization();
  return <PartnerWorkspaceShell isAuthenticated={Boolean(authorization)}>{children}</PartnerWorkspaceShell>;
}

import type { ReactNode } from "react";
import { PartnerWorkspaceShell } from "@/components/agency/PartnerWorkspaceShell";

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return <PartnerWorkspaceShell>{children}</PartnerWorkspaceShell>;
}

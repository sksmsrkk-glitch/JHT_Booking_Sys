import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JHT Operations Platform",
  description: "Inbound travel quotation, reservation, operations, and settlement platform"
};

const domesticSuppliersRoute = "/admin/domestic-suppliers" as Route;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              JHT Operations
            </Link>
            <nav className="nav">
              <Link href="/admin">Internal Admin</Link>
              <Link href={domesticSuppliersRoute}>Domestic Suppliers</Link>
              <Link href={"/admin/quote-cases" as Route}>Quotes</Link>
              <Link href={"/admin/reservations" as Route}>Reservations</Link>
              <Link href="/agency">Overseas Agency Portal</Link>
              <Link href={"/auth/login" as Route}>Sign In</Link>
              <Link href={"/auth/logout" as Route}>Sign Out</Link>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}

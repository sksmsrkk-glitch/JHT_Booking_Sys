import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JHT Operations Platform",
  description: "Inbound travel quotation, reservation, operations, and settlement platform"
};

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
              <Link href="/agency">Overseas Agency Portal</Link>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}

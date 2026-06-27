import type { Route } from "next";
import Link from "next/link";
import { InitialAdminBootstrapForm } from "@/components/admin/InitialAdminBootstrapForm";

const loginRoute = "/auth/login" as Route;

export default function AdminBootstrapPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Initial Setup</p>
          <h1>Admin Bootstrap</h1>
          <p>Create the first company record and internal admin/finance role after creating a Supabase Auth user.</p>
        </div>
        <Link className="button-secondary" href={loginRoute}>
          Sign In
        </Link>
      </div>

      <section className="notice warning">
        <h2>First admin only</h2>
        <p>
          This flow requires `INITIAL_ADMIN_BOOTSTRAP_SECRET`, upserts the JHT company, and is rejected after an admin role exists.
          Remove or rotate the secret after bootstrap.
        </p>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Bootstrap Internal Admin</h2>
          <span>Service role guarded</span>
        </div>
        <InitialAdminBootstrapForm />
      </section>
    </>
  );
}

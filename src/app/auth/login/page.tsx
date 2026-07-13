import { SupabaseLoginForm } from "@/components/auth/SupabaseLoginForm";

type SearchParams = Promise<{ reset?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const resetComplete = (await searchParams).reset === "complete";
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Session</p>
          <h1>Internal Log In</h1>
          <p>JHT team members sign in here. Internal pages require an active Supabase user with an internal role.</p>
        </div>
      </div>
      {resetComplete ? <section className="notice compact"><p>Password updated. Log in with your new password.</p></section> : null}
      <SupabaseLoginForm accountType="internal" buttonLabel="Log In" pendingLabel="Logging in..." redirectTo="/admin" />
    </>
  );
}

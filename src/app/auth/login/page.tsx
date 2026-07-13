import { SupabaseLoginForm } from "@/components/auth/SupabaseLoginForm";
import { resolvePostLoginPath } from "@/lib/domain/auth-session.mjs";

type SearchParams = Promise<{ next?: string; reset?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const resetComplete = params.reset === "complete";
  const redirectTo = resolvePostLoginPath("internal", params.next);
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
      <SupabaseLoginForm accountType="internal" buttonLabel="Log In" pendingLabel="Logging in..." redirectTo={redirectTo} />
    </>
  );
}

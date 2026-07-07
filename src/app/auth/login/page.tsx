import { SupabaseLoginForm } from "@/components/auth/SupabaseLoginForm";

export default function LoginPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Session</p>
          <h1>Internal Log In</h1>
          <p>JHT team members sign in here. Internal pages require an active Supabase user with an internal role.</p>
        </div>
      </div>
      <SupabaseLoginForm buttonLabel="Log In" pendingLabel="Logging in..." redirectTo="/admin" />
    </>
  );
}

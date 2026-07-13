"use client";

import { useState } from "react";

type AgencyPortalUser = {
  id: string;
  email: string;
  name: string;
  title: string | null;
  account_role: "mother" | "sub_account";
  status: string;
  last_login_at: string | null;
};

export function AgencyUserManagement({ users, canManage, actorUserId }: { users: AgencyPortalUser[]; canManage: boolean; actorUserId: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function createUser(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/agency/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: formData.get("email"), name: formData.get("name"), title: formData.get("title") })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Sub account creation failed");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sub account creation failed");
      setIsBusy(false);
    }
  }

  async function updateUser(userId: string, action: "activate" | "deactivate" | "reset_password") {
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/agency/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Account update failed");
      if (action === "reset_password") {
        setMessage("Password reset email sent.");
        setIsBusy(false);
        return;
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account update failed");
      setIsBusy(false);
    }
  }

  return (
    <div className="stacked-form">
      {canManage ? (
        <form action={createUser} className="panel-section stacked-form compact-form">
          <div className="section-heading"><div><h2>Add Sub Account</h2><p>An invitation email is sent immediately.</p></div></div>
          <div className="form-grid three-column">
            <label>Name<input disabled={isBusy} name="name" required /></label>
            <label>Email<input disabled={isBusy} name="email" required type="email" /></label>
            <label>Title<input disabled={isBusy} name="title" /></label>
          </div>
          <button className="button-primary" disabled={isBusy} type="submit">Invite User</button>
        </form>
      ) : null}

      <section className="panel-section">
        <div className="section-heading"><div><h2>Portal Users</h2><p>Mother and sub accounts linked to this partner company.</p></div><span>{users.length} users</span></div>
        <div className="table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead><tbody>
          {users.map((user) => (
            <tr key={user.id}><td><strong>{user.name}</strong><br /><span className="muted-text">{user.email}</span></td><td>{user.account_role === "mother" ? "Mother" : "Sub account"}</td><td>{user.status}</td><td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString("en") : "-"}</td><td>
              {canManage && user.id !== actorUserId && user.account_role === "sub_account" ? <div className="inline-actions">
                <button className="button-secondary" disabled={isBusy} onClick={() => updateUser(user.id, user.status === "active" ? "deactivate" : "activate")} type="button">{user.status === "active" ? "Disable" : "Activate"}</button>
                <button className="button-secondary" disabled={isBusy} onClick={() => updateUser(user.id, "reset_password")} type="button">Reset Password</button>
              </div> : "-"}
            </td></tr>
          ))}
        </tbody></table></div>
      </section>
      {message ? <p className={message.includes("sent") ? "success-text" : "danger-text"}>{message}</p> : null}
    </div>
  );
}

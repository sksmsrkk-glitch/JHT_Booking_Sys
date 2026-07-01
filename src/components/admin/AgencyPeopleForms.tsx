"use client";

import { useState } from "react";

export function AgencyContactCreateForm({ agencyId }: { agencyId: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      role: normalizeOptionalString(formData.get("role")),
      email: normalizeOptionalString(formData.get("email")),
      phone: normalizeOptionalString(formData.get("phone")),
      receivesQuotes: formData.get("receivesQuotes") === "true",
      receivesInvoices: formData.get("receivesInvoices") === "true",
      notes: normalizeOptionalString(formData.get("notes"))
    };

    const response = await fetch(`/api/agencies/${agencyId}/contacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Contact creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Name
          <input disabled={isBusy} name="name" required />
        </label>
        <label>
          Role
          <input disabled={isBusy} name="role" placeholder="Sales, Operation, Finance" />
        </label>
        <label>
          Email
          <input disabled={isBusy} name="email" type="email" />
        </label>
        <label>
          Phone
          <input disabled={isBusy} name="phone" />
        </label>
        <label>
          Quotes
          <select defaultValue="true" disabled={isBusy} name="receivesQuotes">
            <option value="true">Receives</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>
          Invoices
          <select defaultValue="false" disabled={isBusy} name="receivesInvoices">
            <option value="false">No</option>
            <option value="true">Receives</option>
          </select>
        </label>
      </div>
      <label className="full-width-field">
        Notes
        <textarea disabled={isBusy} name="notes" rows={2} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Add Contact
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

export function AgencyUserCreateForm({ agencyId }: { agencyId: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = {
      email: String(formData.get("email") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      title: normalizeOptionalString(formData.get("title")),
      authUserId: normalizeOptionalString(formData.get("authUserId")),
      isAccountAdmin: formData.get("accountRole") === "mother" || formData.get("isAccountAdmin") === "true",
      accountRole: String(formData.get("accountRole") ?? "sub_account"),
      passwordResetRequired: formData.get("passwordResetRequired") !== "false"
    };

    const response = await fetch(`/api/agencies/${agencyId}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Portal user creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Name
          <input disabled={isBusy} name="name" required />
        </label>
        <label>
          Email
          <input disabled={isBusy} name="email" required type="email" />
        </label>
        <label>
          Title
          <input disabled={isBusy} name="title" />
        </label>
        <label>
          Supabase Auth User ID
          <input disabled={isBusy} name="authUserId" placeholder="Optional UUID" />
        </label>
        <label>
          Account Role
          <select defaultValue="sub_account" disabled={isBusy} name="accountRole">
            <option value="sub_account">Sub account</option>
            <option value="mother">Mother ID</option>
          </select>
        </label>
        <label>
          Password
          <select defaultValue="true" disabled={isBusy} name="passwordResetRequired">
            <option value="true">Reset required</option>
            <option value="false">Already set</option>
          </select>
        </label>
      </div>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Add Portal User
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function SupplierContactCreateForm({ supplierId }: { supplierId: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      title: normalizeOptionalString(formData.get("title")),
      email: normalizeOptionalString(formData.get("email")),
      phone: normalizeOptionalString(formData.get("phone")),
      kakaoAvailable: formData.get("kakaoAvailable") === "true",
      receivesBookingMessages: formData.get("receivesBookingMessages") !== "false",
      notes: normalizeOptionalString(formData.get("notes"))
    };

    const response = await safeFetch(`/api/domestic-suppliers/${supplierId}/contacts`, {
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
    requestRouteRefresh();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Name
          <input disabled={isBusy} name="name" placeholder="Contact name" required />
        </label>
        <label>
          Title
          <input disabled={isBusy} name="title" placeholder="Manager, Sales, Reservation" />
        </label>
        <label>
          Email
          <input disabled={isBusy} name="email" placeholder="supplier@example.com" type="email" />
        </label>
        <label>
          Phone
          <input disabled={isBusy} name="phone" placeholder="+82..." />
        </label>
        <label>
          Kakao
          <select defaultValue="false" disabled={isBusy} name="kakaoAvailable">
            <option value="false">Unavailable</option>
            <option value="true">Available</option>
          </select>
        </label>
        <label>
          Booking Messages
          <select defaultValue="true" disabled={isBusy} name="receivesBookingMessages">
            <option value="true">Receives</option>
            <option value="false">Disabled</option>
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

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

"use client";

import { useState } from "react";

export function CountryReferenceCreateForm() {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = {
      countryCode: String(formData.get("countryCode") ?? "").trim().toUpperCase(),
      countryName: String(formData.get("countryName") ?? "").trim(),
      defaultCurrency: String(formData.get("defaultCurrency") ?? "").trim().toUpperCase(),
      aliases: String(formData.get("aliases") ?? "").trim(),
      source: "manual"
    };

    const response = await fetch("/api/countries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Country save failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Country Code
          <input disabled={isBusy} name="countryCode" placeholder="MY" required />
        </label>
        <label>
          Country Name
          <input disabled={isBusy} name="countryName" placeholder="Malaysia" required />
        </label>
        <label>
          Default Currency
          <input disabled={isBusy} name="defaultCurrency" placeholder="MYR" />
        </label>
      </div>
      <label className="full-width-field">
        Aliases
        <input disabled={isBusy} name="aliases" placeholder="Malay, Malaysia Partner typed names" />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Save Country
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { NOTION_CSV_TARGET_TABLES } from "@/features/migration/queries";

export function NotionCsvStagingForm() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const rowsText = String(form.get("rows") ?? "");
    let rows: unknown;
    try {
      rows = JSON.parse(rowsText);
    } catch {
      setMessage("Rows must be a valid JSON array.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch("/api/migrations/notion-csv", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceName: form.get("sourceName"),
        targetTable: form.get("targetTable"),
        rows
      })
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Staging failed");
      setIsSubmitting(false);
      return;
    }

    setMessage(`Staged ${result.data?.rowCount ?? 0} rows.`);
    event.currentTarget.reset();
    window.location.reload();
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="section-heading">
        <h2>Stage Notion CSV Rows</h2>
        <span>Internal only</span>
      </div>
      <div className="form-preview">
        <label>
          Source Name
          <input name="sourceName" placeholder="notion-suppliers-2026-06" required />
        </label>
        <label>
          Target Table
          <select name="targetTable" required>
            {NOTION_CSV_TARGET_TABLES.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="full-width-field">
        Rows JSON
        <textarea
          name="rows"
          placeholder='[{"name_ko":"Sample Supplier","category":"hotel"}]'
          required
          rows={6}
        />
      </label>
      <button className="button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Staging..." : "Stage Rows"}
      </button>
      {message ? <p className={message.includes("failed") || message.includes("valid") ? "danger-text" : "success-text"}>{message}</p> : null}
    </form>
  );
}

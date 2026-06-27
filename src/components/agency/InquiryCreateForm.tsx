"use client";

import { FormEvent, useState } from "react";

const inquiryTypes = [
  "new_inquiry",
  "existing_product_inquiry",
  "revision_request",
  "booking_request",
  "change_request",
  "cancellation_request"
];

const tourTypes = ["", "series_package", "incentive_tour", "private_tour", "mice", "other"];

export function InquiryCreateForm() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = {
      inquiryType: form.get("inquiryType"),
      title: form.get("title"),
      requestedStartDate: form.get("requestedStartDate"),
      requestedEndDate: form.get("requestedEndDate"),
      paxCount: form.get("paxCount"),
      preferredLanguage: form.get("preferredLanguage"),
      tourType: form.get("tourType"),
      requestPayload: {
        notes: form.get("notes")
      }
    };

    const response = await fetch("/api/agency/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Inquiry submission failed");
      setIsSubmitting(false);
      return;
    }

    setMessage("Inquiry submitted.");
    event.currentTarget.reset();
    window.location.reload();
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="section-heading">
        <h2>New Inquiry</h2>
        <span>Agency scoped</span>
      </div>
      <div className="form-preview">
        <label>
          Inquiry Type
          <select name="inquiryType" defaultValue="new_inquiry" required>
            {inquiryTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tour Title
          <input name="title" placeholder="Seoul and Busan incentive tour" required />
        </label>
        <label>
          Requested Start
          <input name="requestedStartDate" type="date" />
        </label>
        <label>
          Requested End
          <input name="requestedEndDate" type="date" />
        </label>
        <label>
          Pax
          <input min="1" name="paxCount" placeholder="20" type="number" />
        </label>
        <label>
          Preferred Language
          <input name="preferredLanguage" placeholder="English" />
        </label>
        <label>
          Tour Type
          <select name="tourType" defaultValue="">
            {tourTypes.map((type) => (
              <option key={type || "blank"} value={type}>
                {type ? formatLabel(type) : "Not set"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="full-width-field">
        Notes
        <textarea name="notes" placeholder="Dates, hotel class, meals, routing, special requests" rows={4} />
      </label>
      <button className="button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Submitting..." : "Submit Inquiry"}
      </button>
      {message ? <p className={message.includes("failed") ? "danger-text" : "success-text"}>{message}</p> : null}
    </form>
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

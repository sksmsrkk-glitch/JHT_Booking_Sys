"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import { parseRoomingListText } from "@/lib/domain/rooming-list.mjs";

export function RoomingListUploadForm({
  reservationId,
  nextRevisionNo = 1
}: {
  reservationId: string;
  nextRevisionNo?: number;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function upload(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    let passengers: unknown[] = [];
    const roomingListText = String(formData.get("roomingListText") ?? "").trim();
    const passengersJson = String(formData.get("passengersJson") ?? "").trim();
    if (roomingListText) {
      const parsed = parseRoomingListText(roomingListText);
      if (parsed.errors.length > 0) {
        setMessage(parsed.errors.slice(0, 3).join("; "));
        setIsBusy(false);
        return;
      }
      passengers = parsed.passengers;
    } else if (passengersJson) {
      try {
        passengers = JSON.parse(passengersJson);
      } catch {
        setMessage("Passengers JSON is invalid");
        setIsBusy(false);
        return;
      }
    }

    const revisionNo = Number(formData.get("revisionNo") ?? nextRevisionNo);
    const originalFilename = String(formData.get("originalFilename") ?? "").trim();
    const payload = {
      reservationId,
      revisionNo,
      originalFilename,
      storagePath: String(formData.get("storagePath") ?? "").trim(),
      idempotencyKey: `${reservationId}:${revisionNo}:${originalFilename}`,
      passengers
    };

    const response = await safeFetch("/api/agency/rooming-lists/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Upload failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <form action={upload} className="stacked-form">
      <div className="form-grid two-column">
        <label>
          Original Filename
          <input name="originalFilename" placeholder="rooming-list.xlsx" required />
        </label>
        <label>
          Revision No.
          <input defaultValue={nextRevisionNo} min="1" name="revisionNo" type="number" />
        </label>
      </div>
      <label className="full-width-field">
        Storage Path
        <input name="storagePath" placeholder="Optional; generated if blank" />
      </label>
      <label className="full-width-field">
        Rooming List CSV/TSV
        <textarea
          name="roomingListText"
          placeholder={"Passenger No,Passenger Name,Gender,DOB,Dietary,Passport No,Coach\n1,Hong Gil Dong,M,1990-01-15,Vegetarian,M1234567,A"}
          rows={6}
        />
      </label>
      <details className="row-details">
        <summary>Advanced JSON</summary>
        <label className="full-width-field">
          Passengers JSON
          <textarea
            name="passengersJson"
            placeholder={'[{"passengerNo":"1","fullName":"Hong Gil Dong"}]'}
            rows={5}
          />
        </label>
      </details>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Upload Rooming List
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

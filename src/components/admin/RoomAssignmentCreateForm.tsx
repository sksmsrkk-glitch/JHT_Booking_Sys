"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import type { ReservationPassengerItem, ReservationRoomingListItem } from "@/features/reservation/types";

export function RoomAssignmentCreateForm({
  reservationId,
  passengers,
  roomingLists,
  disabledReason
}: {
  reservationId: string;
  passengers: ReservationPassengerItem[];
  roomingLists: ReservationRoomingListItem[];
  disabledReason?: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function createRoomAssignment(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const payload = {
      roomNo: normalizeOptionalString(formData.get("roomNo")),
      roomType: String(formData.get("roomType") ?? "").trim(),
      passengerIds: formData.getAll("passengerIds").map((value) => String(value)),
      roomingListId: normalizeOptionalString(formData.get("roomingListId")),
      checkIn: normalizeOptionalString(formData.get("checkIn")),
      checkOut: normalizeOptionalString(formData.get("checkOut")),
      notes: normalizeOptionalString(formData.get("notes"))
    };

    const response = await fetch(`/api/reservations/${reservationId}/room-assignments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Room assignment creation failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <form action={createRoomAssignment} className="stacked-form">
      {disabledReason ? <p className="warning-text">{disabledReason}</p> : null}
      <div className="form-grid three-column">
        <label>
          Room No.
          <input disabled={isBusy || Boolean(disabledReason)} name="roomNo" placeholder="1201" />
        </label>
        <label>
          Room Type
          <input disabled={isBusy || Boolean(disabledReason)} name="roomType" placeholder="Twin / Double / Single" required />
        </label>
        <label>
          Rooming List
          <select disabled={isBusy || Boolean(disabledReason)} name="roomingListId">
            <option value="">No specific revision</option>
            {roomingLists.map((roomingList) => (
              <option key={roomingList.id} value={roomingList.id}>
                rev {roomingList.revisionNo}: {roomingList.originalFilename ?? "Uploaded file"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Check In
          <input disabled={isBusy || Boolean(disabledReason)} name="checkIn" type="date" />
        </label>
        <label>
          Check Out
          <input disabled={isBusy || Boolean(disabledReason)} name="checkOut" type="date" />
        </label>
      </div>

      <fieldset className="checkbox-group" disabled={isBusy || Boolean(disabledReason)}>
        <legend>Passengers</legend>
        {passengers.length > 0 ? (
          passengers.map((passenger) => (
            <label key={passenger.id}>
              <input name="passengerIds" type="checkbox" value={passenger.id} />
              <span>
                {passenger.passengerNo ? `${passenger.passengerNo} - ` : ""}
                {passenger.fullName}
              </span>
            </label>
          ))
        ) : (
          <p>No passengers available.</p>
        )}
      </fieldset>

      <label className="full-width-field">
        Notes
        <textarea disabled={isBusy || Boolean(disabledReason)} name="notes" placeholder="Optional rooming note" rows={3} />
      </label>

      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy || passengers.length === 0 || Boolean(disabledReason)} type="submit">
          Create Room Assignment
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

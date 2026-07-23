/**
 * @file 한글 책임: `Notification Inbox` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 큐잉된 운영 리마인더 알림을 내부 운영자에게 보여주고, 확인(acknowledge) 시 처리 완료로 표시합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";
import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import type { NotificationListItem } from "@/features/operations/types";

const ACTIVE_STATUSES = ["queued", "sent"];

export function NotificationInbox({ notifications }: { notifications: NotificationListItem[] }) {
  const [items, setItems] = useState(notifications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const activeCount = items.filter((item) => ACTIVE_STATUSES.includes(item.status)).length;

  async function acknowledge(id: string) {
    setBusyId(id);
    setMessage("");
    const response = await safeFetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "read" })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Failed to acknowledge the notification.");
      setBusyId(null);
      return;
    }
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status: "read" } : item)));
    setBusyId(null);
    requestRouteRefresh();
  }

  return (
    <section className="panel-section" aria-label="Operation reminders">
      <div className="section-heading">
        <div>
          <h2>Reminders</h2>
          <p>Queued operation reminders routed to internal teams. Acknowledge once handled.</p>
        </div>
        <span>{activeCount} pending</span>
      </div>

      {items.length === 0 ? (
        <p className="subtext">No reminders have been generated yet.</p>
      ) : (
        <section className="table-shell" aria-label="Reminder notifications">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Title</th>
                <th>Detail</th>
                <th>Reservation</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isActive = ACTIVE_STATUSES.includes(item.status);
                return (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{item.title}</td>
                    <td>{item.body ?? item.taskTitle ?? "-"}</td>
                    <td>{item.reservationCode ?? "-"}</td>
                    <td>
                      <span className={`status-dot status-${item.status}`}>{formatLabel(item.status)}</span>
                    </td>
                    <td>
                      {isActive ? (
                        <button
                          className="button-secondary compact-button"
                          disabled={busyId === item.id}
                          onClick={() => acknowledge(item.id)}
                          type="button"
                        >
                          {busyId === item.id ? "Saving..." : "Acknowledge"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {message ? <p className="danger-text">{message}</p> : null}
    </section>
  );
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

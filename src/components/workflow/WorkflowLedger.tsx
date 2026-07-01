"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { WorkflowActionItem, WorkflowMessage, WorkflowThreadDetail } from "@/features/workflow/types";

const messageTypes = [
  ["general", "General"],
  ["quote_revision", "Quote revision"],
  ["hotel_change", "Hotel change"],
  ["meal_change", "Meal change"],
  ["vehicle_change", "Vehicle change"],
  ["attraction_change", "Attraction change"],
  ["cancellation", "Cancellation"],
  ["invoice_question", "Invoice question"],
  ["finance_follow_up", "Finance follow-up"],
  ["operation_update", "Operation update"]
];

const actionCategories = [
  ["hotel", "Hotel"],
  ["meal", "Meal"],
  ["vehicle", "Vehicle"],
  ["attraction", "Attraction"],
  ["guide", "Guide"],
  ["invoice", "Invoice"],
  ["finance", "Finance"],
  ["inspection", "Inspection"],
  ["other", "Other"]
];

/*
 * WorkflowLedger는 파트너와 정호여행사 내부 직원이 같은 workflowCode를 기준으로
 * 문의/회신/수정요청/인보이스 질문/action item을 한 화면에서 보는 커뮤니케이션 원장입니다.
 *
 * actorType이 agency일 때는 파트너에게 보여도 되는 메시지만 다루고,
 * internal일 때는 내부 메모와 follow-up action item까지 함께 다룹니다.
 */
export function WorkflowLedger({
  workflow,
  actorType,
  previewMode = false
}: {
  workflow: WorkflowThreadDetail;
  actorType: "internal" | "agency";
  previewMode?: boolean;
}) {
  const [messages, setMessages] = useState<WorkflowMessage[]>(workflow.messages);
  const [actionItems, setActionItems] = useState<WorkflowActionItem[]>(workflow.actionItems);
  const [body, setBody] = useState("");
  const [messageType, setMessageType] = useState("general");
  const [visibility, setVisibility] = useState<"partner_visible" | "internal_only">("partner_visible");
  const [actionTitle, setActionTitle] = useState("");
  const [actionCategory, setActionCategory] = useState("other");
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState(previewMode ? "Preview mode: messages are simulated until Supabase login is connected." : "");

  const openActionCount = useMemo(
    () => actionItems.filter((item) => item.status === "open" || item.status === "in_progress").length,
    [actionItems]
  );

  async function submitMessage() {
    // 메시지 저장은 화면 상태만 바꾸지 않고 API에 먼저 기록합니다.
    // DB 저장이 성공해야 커뮤니케이션 history와 action item이 같은 workflowCode에 남습니다.
    if (!body.trim()) {
      setNotice("Message body is required.");
      return;
    }
    setIsSending(true);
    setNotice("");
    const response = await fetch(`/api/workflows/${encodeURIComponent(workflow.workflowCode)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        messageType,
        visibility,
        actionTitle,
        actionCategory
      })
    });
    const result = await response.json();
    setIsSending(false);
    if (!response.ok) {
      setNotice(result.error ?? "Message could not be saved.");
      return;
    }

    const nextMessage = mapMessage(result.data.message);
    setMessages((current) => [...current, nextMessage]);
    if (result.data.actionItem) {
      // actionTitle을 입력한 메시지는 follow-up 작업으로도 등록됩니다.
      // 예: "호텔 변경 요청 확인", "인보이스 입금 상태 회신" 등.
      setActionItems((current) => [...current, mapActionItem(result.data.actionItem)]);
    }
    setBody("");
    setActionTitle("");
    setNotice(result.data.preview ? "Preview message added locally." : "Message saved to workflow history.");
  }

  return (
    <section className="workflow-ledger">
      <aside className="workflow-context-panel">
        <div>
          <span className="eyebrow">Workflow Code</span>
          <strong>{workflow.workflowCode}</strong>
          <p>{workflow.title}</p>
        </div>
        <dl>
          <div>
            <dt>Status</dt>
            <dd><span className={`status-dot status-${workflow.status}`}>{formatLabel(workflow.status)}</span></dd>
          </div>
          <div>
            <dt>Partner</dt>
            <dd>{workflow.agencyName ?? "Not linked"}</dd>
          </div>
          <div>
            <dt>Open Actions</dt>
            <dd>{openActionCount}</dd>
          </div>
          <div>
            <dt>Last Message</dt>
            <dd>{formatDateTime(workflow.lastMessageAt ?? messages.at(-1)?.createdAt ?? workflow.createdAt)}</dd>
          </div>
        </dl>
        <nav aria-label="Linked workflow documents" className="workflow-doc-links">
          {workflow.linkedDocs.quoteCaseId ? (
            <Link href={`/admin/quote-cases/${workflow.linkedDocs.quoteCaseId}` as Route}>Quote</Link>
          ) : null}
          {workflow.linkedDocs.reservationId ? (
            <Link href={`/admin/reservations/${workflow.linkedDocs.reservationId}` as Route}>Reservation</Link>
          ) : null}
          {workflow.linkedDocs.invoiceId ? (
            <Link href={`/admin/finance/invoices/${workflow.linkedDocs.invoiceId}` as Route}>Invoice</Link>
          ) : null}
          <Link href={`/agency/workflows/${workflow.workflowCode}` as Route}>Partner View</Link>
        </nav>
      </aside>

      <section className="workflow-message-panel">
        <div className="section-heading">
          <div>
            <h2>Communication History</h2>
            <p>Partner requests, JHT replies, and internal notes are preserved under this workflow code.</p>
          </div>
          <span>{messages.length} messages</span>
        </div>
        <div className="workflow-message-list">
          {messages.map((message) => (
            <article className={`workflow-message ${message.senderType}`} key={message.id}>
              <div>
                <strong>{message.senderName ?? formatLabel(message.senderType)}</strong>
                <span>{formatLabel(message.messageType)} / {formatDateTime(message.createdAt)}</span>
              </div>
              <p>{message.body}</p>
              <footer>
                <span>{message.visibility === "internal_only" ? "Internal only" : "Partner visible"}</span>
                {message.senderEmail ? <span>{message.senderEmail}</span> : null}
              </footer>
            </article>
          ))}
        </div>
        <div className="workflow-composer">
          <div className="form-grid three-column">
            <label>
              Type
              <select value={messageType} onChange={(event) => setMessageType(event.target.value)}>
                {messageTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            {actorType === "internal" ? (
              <label>
                Visibility
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as "partner_visible" | "internal_only")}>
                  <option value="partner_visible">Partner visible</option>
                  <option value="internal_only">Internal only</option>
                </select>
              </label>
            ) : null}
            <label>
              Action Category
              <select value={actionCategory} onChange={(event) => setActionCategory(event.target.value)}>
                {actionCategories.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Message
            <textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a partner reply, internal note, or change request..." />
          </label>
          <label>
            Create Action Item
            <input value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} placeholder="Optional: turn this message into a follow-up task" />
          </label>
          <div className="inline-actions">
            <button disabled={isSending} onClick={submitMessage} type="button">
              Add to Workflow
            </button>
            {notice ? <span className="subtext">{notice}</span> : null}
          </div>
        </div>
      </section>

      <aside className="workflow-action-panel">
        <div className="section-heading">
          <h2>Action Items</h2>
          <span>{openActionCount} open</span>
        </div>
        <div className="workflow-action-list">
          {actionItems.length === 0 ? (
            <p className="subtext">No action items yet.</p>
          ) : (
            actionItems.map((item) => (
              <article className="workflow-action-card" key={item.id}>
                <div>
                  <span>{formatLabel(item.category)}</span>
                  <span className={`status-dot status-${item.status}`}>{formatLabel(item.status)}</span>
                </div>
                <strong>{item.title}</strong>
                {item.details ? <p>{item.details}</p> : null}
              </article>
            ))
          )}
        </div>
      </aside>
    </section>
  );
}

function mapMessage(row: any): WorkflowMessage {
  return {
    id: row.id,
    threadId: row.threadId ?? row.workflow_thread_id,
    senderType: row.senderType ?? row.sender_type,
    senderName: row.senderName ?? row.sender_name ?? null,
    senderEmail: row.senderEmail ?? row.sender_email ?? null,
    messageType: row.messageType ?? row.message_type,
    body: row.body,
    visibility: row.visibility,
    linkedQuoteVersionId: row.linkedQuoteVersionId ?? row.linked_quote_version_id ?? null,
    linkedInvoiceId: row.linkedInvoiceId ?? row.linked_invoice_id ?? null,
    createdAt: row.createdAt ?? row.created_at
  };
}

function mapActionItem(row: any): WorkflowActionItem {
  return {
    id: row.id,
    threadId: row.threadId ?? row.workflow_thread_id,
    sourceMessageId: row.sourceMessageId ?? row.source_message_id ?? null,
    category: row.category,
    title: row.title,
    details: row.details ?? null,
    status: row.status,
    partnerVisible: row.partnerVisible ?? Boolean(row.partner_visible),
    linkedQuoteVersionId: row.linkedQuoteVersionId ?? row.linked_quote_version_id ?? null,
    assignedTo: row.assignedTo ?? row.assigned_to ?? null,
    dueAt: row.dueAt ?? row.due_at ?? null,
    resolvedAt: row.resolvedAt ?? row.resolved_at ?? null,
    createdAt: row.createdAt ?? row.created_at
  };
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AtSign, CheckSquare, FileText, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { JobAttachment } from "@/components/attachments/types";
import type { InternalConversation, InternalMessage, MessagingEmployee } from "@/components/messaging/types";

type Props = {
  initialConversation: InternalConversation | null;
  currentEmployee: MessagingEmployee;
  employees: MessagingEmployee[];
  jobId?: string;
  attachments?: JobAttachment[];
  onClose?: () => void;
  compact?: boolean;
};

export default function InternalMessagePanel({ initialConversation, currentEmployee, employees, jobId, attachments = [], onClose, compact = false }: Props) {
  const [conversation, setConversation] = useState(initialConversation);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mentionable = useMemo(() => employees.filter((employee) => employee.id !== currentEmployee.id), [employees, currentEmployee.id]);

  useEffect(() => {
    if (!conversation?.id) return;
    void api({ action: "read", conversationId: conversation.id });
    const supabase = createClient();
    const channel = supabase.channel(`internal:${conversation.id}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, () => void refresh(conversation.id)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversation?.id]);

  async function refresh(id: string) {
    const response = await fetch(`/api/internal-messages?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setConversation(data.conversation);
  }

  async function send() {
    if (!body.trim()) return;
    setSaving(true); setError("");
    try {
      const data = await api({ action: "send", conversationId: conversation?.id, jobId, body, mentionedEmployeeIds: mentions, attachmentIds });
      setBody(""); setMentions([]); setAttachmentIds([]);
      await refresh(data.conversationId);
    } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
  }

  function addMention(employee: MessagingEmployee) {
    setMentions((current) => current.includes(employee.id) ? current : [...current, employee.id]);
    setBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@${employee.name} `);
  }

  async function edit(item: InternalMessage) {
    const value = window.prompt("Edit message", item.body)?.trim();
    if (!value || value === item.body) return;
    try { await patch({ messageId: item.id, body: value }); await refresh(item.conversation_id); } catch (reason) { setError(message(reason)); }
  }

  async function task(item: InternalMessage) {
    try {
      const result = await api({ action: "task", messageId: item.id });
      setConversation((current) => current ? { ...current, messages: current.messages.map((messageItem) => messageItem.id === item.id ? { ...messageItem, task_id: result.taskId } : messageItem) } : current);
    } catch (reason) { setError(message(reason)); }
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white ${compact ? "min-h-[360px]" : "min-h-[520px]"}`}>
      <header className={`flex items-start justify-between gap-4 border-b border-gray-200 ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
        <div><div className="flex items-center gap-2"><MessageSquare className="size-5" /><h3 className="font-semibold text-gray-950">{conversation?.title ?? "Internal Job Discussion"}</h3></div><p className="mt-1 text-xs font-medium text-purple-700">Internal only · never visible to customers</p></div>
        {onClose ? <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close messages"><X className="size-4" /></button> : null}
      </header>
      <div className={`flex-1 overflow-y-auto bg-gray-50/70 ${compact ? "max-h-[420px] space-y-2 p-3" : "space-y-4 p-5"}`}>
        {conversation?.messages.length ? conversation.messages.map((item) => {
          const mine = item.sender_employee_id === currentEmployee.id;
          return <article key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-lg border shadow-sm ${compact ? "px-3 py-2" : "px-4 py-3"} ${mine ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-900"}`}><div className="flex flex-wrap items-center gap-2 text-[11px]"><strong>{item.sender.name}</strong><time className={mine ? "text-gray-300" : "text-gray-500"}>{formatTime(item.created_at)}</time>{item.edited_at ? <span className={mine ? "text-gray-300" : "text-gray-400"}>(edited)</span> : null}</div><p className={`${compact ? "mt-1 leading-5" : "mt-2 leading-6"} whitespace-pre-wrap text-sm`}>{item.body}</p>{item.attachments.length ? <div className="mt-2 space-y-1">{item.attachments.map((file) => <a key={file.id} href={file.signed_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs underline"><Paperclip className="size-3" />{file.file_name}</a>)}</div> : null}<div className={`mt-2 flex gap-3 text-[11px] ${mine ? "text-gray-300" : "text-gray-500"}`}>{mine ? <button type="button" onClick={() => void edit(item)} className="hover:underline">Edit</button> : null}{item.task_id ? <Link href={`/tasks?task=${item.task_id}`} className="hover:underline">Open task</Link> : <button type="button" onClick={() => void task(item)} className="inline-flex items-center gap-1 hover:underline"><CheckSquare className="size-3" />Create task</button>}</div></div></article>;
        }) : <div className="flex min-h-64 flex-col items-center justify-center text-center text-gray-500"><MessageSquare className="size-8" /><p className="mt-3 text-sm font-medium">Start the internal discussion.</p><p className="mt-1 max-w-sm text-xs">Use this thread for employee notes and coordination about the job.</p></div>}
      </div>
      <div className={`border-t border-gray-200 ${compact ? "p-3" : "p-4"}`}>
        {error ? <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={compact ? 2 : 3} placeholder="Write an internal message…" className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black" />
        <div className="mt-2 flex flex-wrap gap-2">{mentionable.map((employee) => <button key={employee.id} type="button" onClick={() => addMention(employee)} className={`rounded-full border px-2 py-1 text-xs ${mentions.includes(employee.id) ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600"}`}><AtSign className="mr-1 inline size-3" />{employee.name}</button>)}</div>
        {attachments.length ? <label className="mt-3 block text-xs font-medium text-gray-600"><FileText className="mr-1 inline size-3" />Attach an existing job file<select multiple value={attachmentIds} onChange={(event) => setAttachmentIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))} className="mt-1 h-20 w-full rounded-lg border border-gray-300 bg-white p-2"><option disabled value="">Command/Ctrl-click to select files</option>{attachments.map((file) => <option key={file.id} value={file.id}>{file.file_name}</option>)}</select></label> : null}
        <div className="mt-3 flex justify-end"><button type="button" onClick={() => void send()} disabled={saving || !body.trim()} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Send className="size-4" />{saving ? "Sending…" : "Send"}</button></div>
      </div>
    </div>
  );
}

async function api(body: unknown) { const response = await fetch("/api/internal-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }
async function patch(body: unknown) { const response = await fetch("/api/internal-messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }
function message(error: unknown) { return error instanceof Error ? error.message : "Unable to update messages."; }
function formatTime(value: string) { return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

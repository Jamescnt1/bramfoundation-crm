"use client";

import { useState, useTransition } from "react";
import { Mail, MailOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateCustomerEmailReplyRead } from "@/app/actions/customer-email";
import type { CustomerEmailReplySummary } from "@/lib/services/customer-email";

export default function CustomerEmailRepliesCard({ initialReplies }: { initialReplies: CustomerEmailReplySummary[] }) {
  const router = useRouter();
  const [replies, setReplies] = useState(initialReplies);
  const [pending, startTransition] = useTransition();
  const unread = replies.filter((reply) => !reply.is_read).length;

  function setRead(id: string, read: boolean) {
    setReplies((items) => items.map((item) => item.id === id ? { ...item, is_read: read } : item));
    startTransition(async () => {
      try { await updateCustomerEmailReplyRead(id, read); }
      catch { setReplies((items) => items.map((item) => item.id === id ? { ...item, is_read: !read } : item)); }
    });
  }

  function open(reply: CustomerEmailReplySummary) {
    if (reply.is_read) {
      router.push(`/leads/${reply.job_id}?tab=communications`);
      return;
    }
    setReplies((items) => items.map((item) => item.id === reply.id ? { ...item, is_read: true } : item));
    startTransition(async () => {
      try {
        await updateCustomerEmailReplyRead(reply.id, true);
        router.push(`/leads/${reply.job_id}?tab=communications`);
      } catch {
        setReplies((items) => items.map((item) => item.id === reply.id ? { ...item, is_read: false } : item));
      }
    });
  }

  return <section className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><Mail className="size-4 text-blue-600"/><h2 className="text-base font-semibold">Customer Email Replies</h2>{unread ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{unread} new</span> : null}</div><p className="mt-0.5 text-xs text-gray-500">Replies to your assigned jobs.</p></div>
    </div>
    <div className="mt-2 divide-y divide-gray-100">
      {replies.length ? replies.map((reply) => <article key={reply.id} className={`py-2.5 ${reply.is_read ? "" : "bg-blue-50/60"}`}>
        <div className="flex min-w-0 items-start gap-2 px-1">
          <button type="button" onClick={() => open(reply)} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${reply.is_read ? "bg-gray-300" : "bg-blue-600"}`}/><p className={`truncate text-sm ${reply.is_read ? "font-medium text-gray-800" : "font-semibold text-gray-950"}`}>{reply.subject || "Customer reply"}</p></div>
            <p className="mt-0.5 truncate pl-4 text-xs font-medium text-gray-600">{reply.job_name}{reply.qf_number ? ` · QF# ${reply.qf_number}` : ""}</p>
            <p className="mt-0.5 truncate pl-4 text-[11px] text-gray-400">From {reply.sender}</p>
            <p className="mt-0.5 line-clamp-2 pl-4 text-xs leading-5 text-gray-500">{reply.preview || "No message preview available."}</p>
            <p className="mt-1 pl-4 text-[11px] text-gray-400">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(reply.received_at))}</p>
          </button>
          <button type="button" disabled={pending} onClick={() => setRead(reply.id, !reply.is_read)} className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={reply.is_read ? "Mark unread" : "Mark read"} title={reply.is_read ? "Mark unread" : "Mark read"}>{reply.is_read ? <Mail className="size-4"/> : <MailOpen className="size-4"/>}</button>
        </div>
      </article>) : <p className="py-6 text-center text-sm text-gray-500">No customer replies yet.</p>}
    </div>
  </section>;
}

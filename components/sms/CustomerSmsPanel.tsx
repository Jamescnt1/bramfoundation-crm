"use client";

import { useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { sendJobCustomerSmsAction } from "@/app/actions/customer-sms";
import type { JobSmsDelivery, JobSmsRecipient } from "@/components/sms/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
  recipient: string;
  recipientOptions: JobSmsRecipient[];
  deliveries: JobSmsDelivery[];
  canSend: boolean;
};

export default function CustomerSmsPanel({ jobId, recipient, recipientOptions, deliveries, canSend }: Props) {
  const router = useRouter();
  const [to, setTo] = useState(recipient);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function send() {
    setSending(true); setNotice(""); setError("");
    const response = await sendJobCustomerSmsAction({ jobId, recipient: to, body });
    if (response.ok) {
      setBody("");
      setNotice("Text sent and added to this job’s communication history.");
      router.refresh();
    } else setError(response.error);
    setSending(false);
  }

  return <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
    <div className="rounded-lg border border-green-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-green-700"/><div><h3 className="font-semibold text-gray-950">Customer Text</h3><p className="text-sm text-gray-500">Manual, consent-based, and recorded on this job.</p></div></div>
      {canSend ? <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">To<Input inputMode="tel" value={to} onChange={(event) => setTo(event.target.value)} placeholder="+16025551234"/></label>
        {recipientOptions.length ? <div className="-mt-2 flex flex-wrap gap-2">{recipientOptions.map((option) => <button key={`${option.label}-${option.phone}`} type="button" onClick={() => setTo(option.phone)} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">{option.label}: {option.name}</button>)}</div> : null}
        <label className="grid gap-1.5 text-sm font-medium">Message<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} maxLength={1200} className="rounded-lg border border-gray-300 p-3 text-sm" placeholder="Write a concise operational text message..."/><span className="text-right text-xs font-normal text-gray-500">{body.length}/1200</span></label>
        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Send only to a beta participant who has texted START. Scheduled and automated texts remain disabled.</p>
        {notice ? <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p> : null}
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <Button type="button" onClick={() => void send()} disabled={sending || !to.trim() || !body.trim()}><Send/>{sending ? "Sending..." : "Send Text"}</Button>
      </div> : <p className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">You can view text history, but your role cannot send customer texts.</p>}
    </div>
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-gray-950">Text History</h3><p className="mt-1 text-sm text-gray-500">Inbound and outbound messages connected to this job.</p>
      <div className="mt-3 space-y-2">{deliveries.length ? deliveries.map((delivery) => <SmsEntry key={delivery.id} delivery={delivery}/>) : <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-gray-500">No customer texts have been recorded for this job.</p>}</div>
    </div>
  </div>;
}

function SmsEntry({ delivery }: { delivery: JobSmsDelivery }) {
  const failed = delivery.status === "failed" || delivery.status === "undelivered";
  return <article className="rounded-lg border border-gray-200 p-3"><div className="flex items-start justify-between gap-3"><div><span className="text-[11px] font-semibold uppercase text-gray-500">{delivery.direction}</span><p className="mt-1 text-xs text-gray-500">{delivery.direction === "inbound" ? delivery.sender_address : delivery.recipient_address}</p></div><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${failed ? "bg-red-50 text-red-700" : delivery.status === "delivered" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>{delivery.status}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{delivery.body}</p><time className="mt-2 block text-xs text-gray-500">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(delivery.created_at))}</time>{delivery.failure_reason ? <p className="mt-2 text-xs text-red-700">{delivery.failure_reason}{delivery.provider_error_code ? ` (Twilio ${delivery.provider_error_code})` : ""}</p> : null}</article>;
}

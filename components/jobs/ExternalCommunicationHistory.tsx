import { Mail, MessageSquareText } from "lucide-react";
import type { CustomerEmail } from "@/components/email/types";
import type { JobSmsDelivery } from "@/components/sms/types";

type HistoryItem = {
  id: string; channel: "email" | "sms"; direction: string; status: string;
  address: string; subject?: string; body: string; createdAt: string; failure?: string | null;
};

export default function ExternalCommunicationHistory({ emails, texts }: { emails: CustomerEmail[]; texts: JobSmsDelivery[] }) {
  const items: HistoryItem[] = [
    ...emails.map((item) => ({ id: item.id, channel: "email" as const, direction: item.direction, status: item.status, address: item.direction === "inbound" ? item.sender : item.recipient, subject: item.subject, body: item.body, createdAt: item.created_at, failure: item.failure_reason })),
    ...texts.map((item) => ({ id: item.id, channel: "sms" as const, direction: item.direction, status: item.status, address: item.direction === "inbound" ? item.sender_address ?? "" : item.recipient_address, body: item.body, createdAt: item.created_at, failure: item.failure_reason })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h3 className="font-semibold text-gray-950">Customer communication history</h3><p className="mt-1 text-xs text-gray-500">Email and text messages combined in chronological order.</p>
    <div className="mt-3 divide-y divide-gray-100">{items.length ? items.map((item) => { const failed = ["failed", "undelivered"].includes(item.status); return <article key={`${item.channel}-${item.id}`} className="py-3 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center gap-2 text-xs">{item.channel === "email" ? <Mail className="h-3.5 w-3.5 text-blue-600"/> : <MessageSquareText className="h-3.5 w-3.5 text-green-700"/>}<span className="font-semibold capitalize text-gray-700">{item.channel === "sms" ? "Text" : "Email"} · {item.direction}</span><span className={`rounded-full px-2 py-0.5 font-semibold capitalize ${failed ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>{item.status}</span><time className="ml-auto text-gray-400">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time></div><p className="mt-1 text-xs text-gray-500">{item.address}</p>{item.subject ? <p className="mt-1 text-sm font-semibold text-gray-900">{item.subject}</p> : null}<p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-700">{item.body}</p>{item.failure ? <p className="mt-1 text-xs text-red-700">{item.failure}</p> : null}</article>; }) : <p className="rounded-md border border-dashed p-3 text-sm text-gray-500">No customer communications have been recorded for this job.</p>}</div>
  </section>;
}

"use client";

import { useMemo, useState } from "react";
import { FileText, Mail, Paperclip, Send } from "lucide-react";
import { sendJobCustomerEmail } from "@/app/actions/customer-email";
import type { JobAttachment } from "@/components/attachments/types";
import type { CustomerEmail, EmailTemplate } from "@/components/email/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = { jobId: string; recipient: string; emails: CustomerEmail[]; templates: EmailTemplate[];
  attachments: JobAttachment[]; canSend: boolean; compact?: boolean };

export default function CustomerEmailPanel({ jobId, recipient, emails, templates, attachments, canSend, compact = false }: Props) {
  const [to, setTo] = useState(recipient); const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState(""); const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const availableAttachments = useMemo(() => attachments.filter((item) => !item.archived_at), [attachments]);
  function chooseTemplate(id: string) {
    setTemplateId(id); const template = templates.find((item) => item.id === id);
    if (template) { setSubject(template.subject); setBody(template.body); }
  }
  async function send() {
    setSending(true); setError(""); setNotice("");
    try {
      await sendJobCustomerEmail({ jobId, recipient: to, subject, body, templateId: templateId || null, attachmentIds });
      setSubject(""); setBody(""); setTemplateId(""); setAttachmentIds([]); setNotice("Email sent and added to the job history.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send email."); }
    finally { setSending(false); }
  }
  return <div className={`grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)] ${compact ? "gap-3" : "gap-5"}`}>
    <div className={`rounded-lg border border-blue-200 bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600"/><div><h3 className="font-semibold text-gray-950">Customer Email</h3><p className="text-sm text-gray-500">Customer-facing and recorded on this job.</p></div></div>
      {canSend ? <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">To<Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com"/></label>
        <label className="grid gap-1.5 text-sm font-medium">Template<select value={templateId} onChange={(e) => chooseTemplate(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="">Write manually</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.category} — {item.name}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm font-medium">Subject<Input value={subject} onChange={(e) => setSubject(e.target.value)}/></label>
        <label className="grid gap-1.5 text-sm font-medium">Message<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="rounded-lg border border-gray-300 p-3 text-sm" placeholder="Write the customer email..."/></label>
        {availableAttachments.length ? <fieldset><legend className="flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4"/>Attach existing job files</legend><div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-lg border p-3">{availableAttachments.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={attachmentIds.includes(item.id)} onChange={(e) => setAttachmentIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/><span className="truncate">{item.file_name}</span></label>)}</div></fieldset> : null}
        {notice ? <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p> : null}
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <Button type="button" onClick={() => void send()} disabled={sending || !to.trim() || !subject.trim() || !body.trim()}><Send/>{sending ? "Sending..." : "Send Email"}</Button>
      </div> : <p className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">You can view email history, but your role cannot send customer email.</p>}
    </div>
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
      <h3 className="font-semibold text-gray-950">Email History</h3><p className="mt-1 text-sm text-gray-500">Inbound and outbound customer messages.</p>
      <div className={`${compact ? "mt-3 space-y-2" : "mt-4 space-y-3"}`}>{emails.length ? emails.map((email) => <EmailEntry key={email.id} email={email} compact={compact}/>) : <p className={`rounded-lg border border-dashed text-sm text-gray-500 ${compact ? "px-3 py-2" : "p-5 text-center"}`}>No customer email has been recorded for this job.</p>}</div>
    </div>
  </div>;
}

function EmailEntry({ email, compact = false }: { email: CustomerEmail; compact?: boolean }) {
  const tones = { draft: "bg-gray-100 text-gray-700", queued: "bg-amber-50 text-amber-700", sent: "bg-blue-50 text-blue-700", delivered: "bg-green-50 text-green-700", failed: "bg-red-50 text-red-700" };
  return <article className={`rounded-lg border border-gray-200 ${compact ? "p-3" : "p-4"}`}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase text-gray-500">{email.direction}</span>{email.is_automated ? <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">Automated</span> : null}</div><h4 className="mt-0.5 text-sm font-semibold text-gray-950">{email.subject}</h4></div><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${tones[email.status]}`}>{email.status}</span></div>
    <dl className="mt-3 grid gap-1 text-xs text-gray-500"><div><dt className="inline font-medium">From: </dt><dd className="inline">{email.sender}</dd></div><div><dt className="inline font-medium">To: </dt><dd className="inline">{email.recipient}</dd></div><div>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(email.created_at))}</div></dl>
    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{email.body}</p>
    {email.attachments.length ? <div className="mt-3 flex flex-wrap gap-2">{email.attachments.map((item) => <a key={item.id} href={item.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium"><FileText className="h-3 w-3"/>{item.file_name}</a>)}</div> : null}
    {email.failure_reason ? <p className="mt-2 text-xs text-red-700">{email.failure_reason}</p> : null}
  </article>;
}

"use client";

import { useState } from "react";
import { BellRing, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { sendAppointmentNotificationAction } from "@/app/actions/appointment-notifications";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { AppointmentNotificationAudience, AppointmentNotificationChannel, AppointmentNotificationDelivery, AppointmentNotificationKind, CalendarCommunicationData } from "@/components/calendar/communication-types";
import { Button } from "@/components/ui/button";

type Props = { appointment: CalendarAppointment; communication: CalendarCommunicationData };

export default function AppointmentNotificationsPanel({ appointment, communication }: Props) {
  const router = useRouter();
  const audiences = availableAudiences(appointment);
  const [audience, setAudience] = useState<AppointmentNotificationAudience>(audiences[0] ?? "customer");
  const [channel, setChannel] = useState<AppointmentNotificationChannel>("sms");
  const [kind, setKind] = useState<AppointmentNotificationKind>("confirmation");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const history = communication.deliveriesByAppointment[appointment.id] ?? [];

  async function send() {
    setSending(true); setNotice(""); setError("");
    const response = await sendAppointmentNotificationAction({ appointmentId: appointment.id, audience, channel, kind });
    if (response.ok) {
      setNotice(`${response.result.count} ${audienceLabel(audience)} notification${response.result.count === 1 ? "" : "s"} sent.`);
      router.refresh();
    } else setError(response.error);
    setSending(false);
  }

  return <section className="border-t border-gray-200 p-5">
    <div className="flex items-start gap-2"><BellRing className="mt-0.5 h-4 w-4 text-blue-700"/><div><h3 className="font-semibold text-gray-900">Appointment notifications</h3><p className="mt-1 text-xs leading-5 text-gray-500">Send a confirmation or reminder now. Automatic reminders remain paused.</p></div></div>
    {audiences.length ? <div className="mt-4 grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs font-medium text-gray-600">Recipient<select value={audience} onChange={(event) => setAudience(event.target.value as AppointmentNotificationAudience)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm">{audiences.map((item) => <option key={item} value={item}>{audienceLabel(item)}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium text-gray-600">Type<select value={kind} onChange={(event) => setKind(event.target.value as AppointmentNotificationKind)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"><option value="confirmation">Confirmation</option><option value="reminder">Reminder</option></select></label>
      </div>
      <div className="grid grid-cols-2 gap-2">{(["sms", "email"] as const).map((item) => <button key={item} type="button" onClick={() => setChannel(item)} className={`rounded-md border px-3 py-2 text-sm font-medium ${channel === item ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-600"}`}>{item === "sms" ? "Text" : "Email"}</button>)}</div>
      {!communication.controls[audience] ? <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">{audienceLabel(audience)} calendar notifications are paused in Settings.</p> : null}
      {channel === "sms" && !communication.controls.sms ? <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">Text Messages are paused in Settings.</p> : null}
      {channel === "email" && !communication.controls.email ? <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">Notification Emails are paused in Settings.</p> : null}
      {notice ? <p className="rounded-md bg-green-50 p-2 text-xs text-green-700">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      <Button type="button" size="sm" onClick={() => void send()} disabled={sending || !communication.controls[audience] || (channel === "sms" ? !communication.controls.sms : !communication.controls.email)}><Send/>{sending ? "Sending..." : `Send ${kind}`}</Button>
    </div> : <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-gray-500">Assign a job, employee, or installer crew to notify someone about this appointment.</p>}
    <div className="mt-5"><h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notification history</h4><div className="mt-2 space-y-2">{history.length ? history.slice(0, 8).map((delivery) => <HistoryItem key={delivery.id} delivery={delivery}/>) : <p className="text-xs text-gray-500">No notifications sent for this appointment.</p>}</div></div>
  </section>;
}

function availableAudiences(appointment: CalendarAppointment): AppointmentNotificationAudience[] {
  return [appointment.job_id ? "customer" : null, appointment.assigned_employee_id ? "employee" : null, appointment.installer_crew_id ? "installer" : null].filter((item): item is AppointmentNotificationAudience => Boolean(item));
}
function audienceLabel(value: AppointmentNotificationAudience) { return value === "installer" ? "Install crew" : value === "employee" ? "Assigned employee" : "Customer"; }
function HistoryItem({ delivery }: { delivery: AppointmentNotificationDelivery }) { const failed = ["failed", "undelivered"].includes(delivery.status); return <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-medium capitalize text-gray-700">{delivery.recipient_type} · {delivery.channel}</span><span className={failed ? "text-red-700" : "text-gray-500"}>{delivery.status}</span></div><p className="mt-1 line-clamp-2 text-gray-600">{delivery.body}</p><p className="mt-1 text-gray-400">{new Date(delivery.created_at).toLocaleString()}</p>{delivery.failure_reason ? <p className="mt-1 text-red-700">{delivery.failure_reason}</p> : null}</div>; }

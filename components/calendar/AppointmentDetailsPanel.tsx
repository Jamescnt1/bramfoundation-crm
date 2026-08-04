import Link from "next/link";
import { CalendarDays, Check, MapPin, Paperclip, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isQfNumberRequired } from "@/components/pipeline/constants";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { Employee } from "@/lib/services/employees";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import { formatJobDisplayName } from "@/lib/job-display";
import {
  formatAppointmentDisplayName,
  formatAppointmentType,
} from "@/lib/appointment-display";
import { AddressLink, EmailLink, PhoneLink } from "@/components/contact/ActionableContactLinks";
import { formatAppointmentTime, formatDateTime } from "@/lib/date-time";

type AppointmentDetailsPanelProps = {
  appointment: CalendarAppointment | null;
  selectedDate: Date | null;
  employees: Employee[];
  installerCrews: InstallerCrew[];
  isCompleting: boolean;
  actionError?: string;
  onEditAppointment?: (appointment: CalendarAppointment) => void;
  onCompleteAppointment?: (appointment: CalendarAppointment) => void;
  onDeleteAppointment?: (appointment: CalendarAppointment) => void;
};

function label(value: string | null | undefined) {
  return (value ?? "Appointment")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string | Date) {
  return formatDateTime(value, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AppointmentDetailsPanel({
  appointment,
  selectedDate,
  employees,
  installerCrews,
  isCompleting,
  actionError,
  onEditAppointment,
  onCompleteAppointment,
  onDeleteAppointment,
}: AppointmentDetailsPanelProps) {
  const employee = employees.find((item) => item.id === appointment?.assigned_employee_id);
  const installerCrew = installerCrews.find((item) => item.id === appointment?.installer_crew_id);

  return (
    <aside className="rounded-xl border border-gray-200 bg-white shadow-sm xl:sticky xl:top-6">
      {!appointment ? (
        <div className="p-6">
          <p className="text-sm font-medium text-gray-500">Selected date</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {selectedDate ? formatDate(selectedDate) : "No date selected"}
          </p>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            Select an event to see its customer, assignment, notes, and actions here.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-gray-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Event details</p>
            <h2 className="mt-2 text-xl font-semibold text-gray-900">{formatAppointmentDisplayName({ appointmentType: appointment.appointment_type, customerName: appointment.job?.customer?.full_name, jobName: appointment.job?.customer_name })}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{formatAppointmentType(appointment.appointment_type, appointment.appointment_type_record?.name)}</span>
              <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">{label(appointment.status)}</span>
            </div>
          </div>

          <div className="space-y-5 p-5 text-sm">
            <div className="flex gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-gray-400" /><div><p className="font-medium text-gray-900">{formatDate(appointment.starts_at)}{appointment.appointment_type === "installation" && appointment.ends_at ? ` – ${formatDate(appointment.ends_at)}` : ""}</p><p className="mt-1 text-gray-500">{appointment.all_day ? "All Day · 7:00 AM–3:00 PM" : `${formatAppointmentTime(appointment.starts_at)}${appointment.ends_at ? ` – ${formatAppointmentTime(appointment.ends_at)}` : ""}`}{appointment.recurrence_series_id ? " · Recurring" : ""}</p></div></div>
            <div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-gray-400" /><div><p className="text-gray-500">{appointment.appointment_type === "installation" ? "Install crew" : "Assigned employee"}</p><p className="mt-1 font-medium text-gray-900">{appointment.appointment_type === "installation" ? installerCrew?.name ?? appointment.installer_crew?.name ?? "Unassigned crew" : employee?.name ?? "Unassigned"}</p></div></div>
            <div className="flex gap-3"><MapPin className="mt-2 h-4 w-4 text-gray-400" /><div><p className="text-gray-500">Location</p>{appointment.location || appointment.job?.address ? <AddressLink value={appointment.location || appointment.job?.address} className="mt-1 font-medium text-gray-900" /> : <p className="mt-1 text-gray-500">No location provided</p>}</div></div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Customer / job</p>
              {appointment.job ? (
                <>
                  <Link href={`/leads/${appointment.job.id}`} className="mt-2 block font-semibold text-gray-900 hover:underline">
                    {formatJobDisplayName({ customerName: appointment.job.customer?.full_name, jobName: appointment.job.customer_name, qfNumber: appointment.job.qfloors_job_number })}
                  </Link>
                  {isQfNumberRequired(appointment.job.status) && !appointment.job.qfloors_job_number?.trim() ? (
                    <p className="mt-1 text-xs font-semibold text-red-700">QF# required</p>
                  ) : null}
                  <div className="mt-3 flex gap-3 text-xs font-medium"><Link href={`/leads/${appointment.job.id}`} className="hover:underline">Open job</Link><Link href={`/customers`} className="hover:underline">Customers</Link></div>
                </>
              ) : <p className="mt-2 text-gray-500">No job linked</p>}
            </div>

            <div className="grid gap-3 rounded-lg border border-gray-200 p-4 text-xs">
              <div>
                <p className="font-semibold uppercase tracking-wide text-gray-500">Company contact</p>
                <ContactDetails contact={appointment.job?.company_contact ?? null} />
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-gray-500">Project / job contact</p>
                <ContactDetails contact={appointment.job?.project_contact ?? null} fallbackName={appointment.job?.project_customer_name ?? appointment.job?.customer_name} fallbackPhone={appointment.job?.phone} fallbackEmail={appointment.job?.email} />
              </div>
              {appointment.job?.job_site_contact ? <div>
                <p className="font-semibold uppercase tracking-wide text-gray-500">Job site contact</p>
                <ContactDetails contact={appointment.job?.job_site_contact ?? null} />
              </div> : null}
            </div>

            <div><p className="font-medium text-gray-500">Notes</p><p className="mt-2 whitespace-pre-wrap leading-6 text-gray-900">{appointment.notes || "No notes provided."}</p></div>
            {actionError ? <div className="rounded-lg bg-red-50 p-3 text-red-700">{actionError}</div> : null}
          </div>

          <div className="grid gap-2 border-t border-gray-200 p-5">
            {appointment.status !== "completed" && appointment.status !== "cancelled" ? (
              <Button type="button" onClick={() => onCompleteAppointment?.(appointment)} disabled={isCompleting}>
                <Check /> {isCompleting ? "Completing..." : "Mark complete"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onEditAppointment?.(appointment)}>Edit appointment</Button>
            <Button type="button" variant="destructive" onClick={() => onDeleteAppointment?.(appointment)}>Delete appointment</Button>
          </div>

          <div className="border-t border-gray-200 bg-gray-50 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400"><Paperclip className="h-4 w-4" />Future workspace</div>
            <p className="mt-2 text-xs leading-5 text-gray-500">Attachments, comments, and activity history will appear here.</p>
          </div>
        </>
      )}
    </aside>
  );
}

function ContactDetails({ contact, fallbackName, fallbackPhone, fallbackEmail }: { contact: NonNullable<NonNullable<CalendarAppointment["job"]>["company_contact"]> | null; fallbackName?: string | null; fallbackPhone?: string | null; fallbackEmail?: string | null }) {
  if (!contact && !fallbackName && !fallbackPhone && !fallbackEmail) return <p className="mt-1 text-gray-500">Not assigned</p>;
  if (!contact) return <div className="mt-1"><p className="font-medium text-gray-900">{fallbackName ?? "Project contact"}</p><div className="flex flex-wrap gap-x-2"><PhoneLink value={fallbackPhone} label={fallbackName ?? "Project contact"} className="min-h-7"/><EmailLink value={fallbackEmail} label={fallbackName ?? "Project contact"} className="min-h-7"/></div></div>;
  const name = `${contact.first_name} ${contact.last_name}`.trim();
  return (
    <div className="mt-1">
      <p className="font-medium text-gray-900">{name}{contact.job_title ? ` · ${contact.job_title}` : ""}</p>
      <div className="flex flex-wrap gap-x-2">
        <PhoneLink value={contact.mobile_phone} label={name} className="min-h-7" />
        <PhoneLink value={contact.office_phone} label={`${name} office`} className="min-h-7" />
        <EmailLink value={contact.email} label={name} className="min-h-7" />
      </div>
    </div>
  );
}

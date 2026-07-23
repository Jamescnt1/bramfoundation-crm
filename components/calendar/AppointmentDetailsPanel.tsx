import Link from "next/link";
import { CalendarDays, Check, MapPin, Paperclip, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isQfNumberRequired } from "@/components/pipeline/constants";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { Employee } from "@/lib/services/employees";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import { formatJobDisplayName } from "@/lib/job-display";

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
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
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
            <h2 className="mt-2 text-xl font-semibold text-gray-900">{appointment.title || "Untitled appointment"}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{label(appointment.appointment_type)}</span>
              <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">{label(appointment.status)}</span>
            </div>
          </div>

          <div className="space-y-5 p-5 text-sm">
            <div className="flex gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-gray-400" /><div><p className="font-medium text-gray-900">{formatDate(appointment.starts_at)}{appointment.appointment_type === "installation" && appointment.ends_at ? ` – ${formatDate(appointment.ends_at)}` : ""}</p><p className="mt-1 text-gray-500">{formatTime(appointment.starts_at)}{appointment.ends_at ? ` – ${formatTime(appointment.ends_at)}` : ""}</p></div></div>
            <div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-gray-400" /><div><p className="text-gray-500">{appointment.appointment_type === "installation" ? "Install crew" : "Assigned employee"}</p><p className="mt-1 font-medium text-gray-900">{appointment.appointment_type === "installation" ? installerCrew?.name ?? appointment.installer_crew?.name ?? "Unassigned crew" : employee?.name ?? "Unassigned"}</p></div></div>
            <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 text-gray-400" /><div><p className="text-gray-500">Location</p><p className="mt-1 whitespace-pre-wrap font-medium text-gray-900">{appointment.location || "No location provided"}</p></div></div>

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

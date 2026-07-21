import AppointmentCard from "@/components/calendar/AppointmentCard";
import type { CalendarAppointment } from "@/components/calendar/types";
import { formatJobDisplayName } from "@/lib/job-display";

type CalendarListViewProps = {
  appointments: CalendarAppointment[];
  selectedAppointmentId: string | null;
  onSelectAppointment: (appointment: CalendarAppointment) => void;
};

export default function CalendarListView({
  appointments,
  selectedAppointmentId,
  onSelectAppointment,
}: CalendarListViewProps) {
  const upcoming = appointments
    .filter((appointment) => new Date(appointment.starts_at) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  if (!upcoming.length) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium text-gray-900">No upcoming appointments</p>
        <p className="mt-1 text-sm text-gray-500">New appointments will appear here in date order.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {upcoming.map((appointment) => (
        <div key={appointment.id} className="grid gap-3 p-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(appointment.starts_at))}
            </p>
            <p className="mt-1 text-xs text-gray-500">{appointment.job ? formatJobDisplayName({ customerName: appointment.job.customer?.full_name, jobName: appointment.job.customer_name, qfNumber: appointment.job.qfloors_job_number }) : "General appointment"}</p>
          </div>
          <AppointmentCard
            appointment={appointment}
            selected={selectedAppointmentId === appointment.id}
            onSelect={onSelectAppointment}
          />
        </div>
      ))}
    </div>
  );
}

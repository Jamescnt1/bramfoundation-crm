import type { CalendarAppointment } from "@/components/calendar/types";
import AppointmentTooltip from "@/components/calendar/AppointmentTooltip";
import {
  formatAppointmentDisplayName,
  formatAppointmentType,
} from "@/lib/appointment-display";

type AppointmentCardProps = {
  appointment: CalendarAppointment;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (appointment: CalendarAppointment) => void;
};

function formatAppointmentTime(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

function getAppointmentStyles(type: string | null) {
  switch (type) {
    case "measure":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";

    case "installation":
      return "border-green-200 bg-green-50 text-green-900";

    case "follow_up":
      return "border-purple-200 bg-purple-50 text-purple-900";

    default:
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

export default function AppointmentCard({
  appointment,
  compact = false,
  selected = false,
  onSelect,
}: AppointmentCardProps) {
  return (
    <AppointmentTooltip appointment={appointment}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(appointment);
        }}
        className={`block w-full rounded-md border text-left transition hover:brightness-95 ${getAppointmentStyles(
          appointment.appointment_type,
        )} ${
          compact
            ? "px-2 py-1.5 text-[11px]"
            : "px-3 py-2 text-[11px]"
        } ${
          selected
            ? "ring-2 ring-black ring-offset-1"
            : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">
            {formatAppointmentTime(appointment.starts_at)}
          </p>

          {!compact ? (
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide opacity-75">
              {formatAppointmentType(
                appointment.appointment_type,
              )}
            </p>
          ) : null}
        </div>

        <p className="mt-1 truncate">
          {formatAppointmentDisplayName({
            appointmentType: appointment.appointment_type,
            customerName: appointment.job?.customer?.full_name,
            jobName: appointment.job?.customer_name,
          })}
        </p>
      </button>
    </AppointmentTooltip>
  );
}

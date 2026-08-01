import type { CalendarAppointment } from "@/components/calendar/types";
import AppointmentTooltip from "@/components/calendar/AppointmentTooltip";
import {
  AppointmentTypeIcon,
  getReadableTextColor,
  normalizeCalendarColor,
} from "@/components/calendar/appointment-appearance";
import {
  formatAppointmentDisplayName,
  formatAppointmentType,
} from "@/lib/appointment-display";
import { formatAppointmentTime } from "@/lib/date-time";

type AppointmentCardProps = {
  appointment: CalendarAppointment;
  compact?: boolean;
  showTime?: boolean;
  selected?: boolean;
  onSelect?: (appointment: CalendarAppointment) => void;
  className?: string;
};

export default function AppointmentCard({
  appointment,
  compact = false,
  showTime = true,
  selected = false,
  onSelect,
  className = "",
}: AppointmentCardProps) {
  const backgroundColor = normalizeCalendarColor(
    appointment.assigned_employee?.color,
  );
  const color = getReadableTextColor(backgroundColor);
  const displayName = formatAppointmentDisplayName({
    appointmentType: appointment.appointment_type,
    customerName: appointment.job?.customer?.full_name,
    jobName: appointment.job?.customer_name,
  });
  const typeLabel = formatAppointmentType(
    appointment.appointment_type,
    appointment.appointment_type_record?.name,
  );
  const customerName = appointment.job?.customer?.full_name?.trim();
  const jobName = appointment.job?.customer_name?.trim();
  const badgeLabel =
    customerName && jobName
      ? `${customerName} / ${jobName}`
      : jobName || customerName || typeLabel;

  return (
    <AppointmentTooltip appointment={appointment} displayName={displayName}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(appointment);
        }}
        style={{ backgroundColor, color }}
        aria-label={`${typeLabel}: ${badgeLabel}`}
        className={`block w-full min-w-0 rounded-md border border-black/10 text-left shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 ${
          compact ? "px-2 py-1.5 text-[11px]" : "px-2.5 py-2 text-xs"
        } ${selected ? "ring-2 ring-black ring-offset-1" : ""} ${className}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <AppointmentTypeIcon
            type={appointment.appointment_type}
            className="h-3.5 w-3.5 shrink-0"
          />
          <span className="sr-only">{typeLabel}: </span>
          <span className="min-w-0 flex-1 truncate font-semibold">
            {badgeLabel}
          </span>
          {showTime ? (
            <span className="shrink-0 text-[10px] font-semibold opacity-85">
              {appointment.all_day ? "All Day" : formatAppointmentTime(appointment.starts_at)}
            </span>
          ) : null}
        </span>
      </button>
    </AppointmentTooltip>
  );
}

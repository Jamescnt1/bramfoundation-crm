import AppointmentCard from "@/components/calendar/AppointmentCard";
import type { CalendarAppointment } from "@/components/calendar/types";
import {
  formatDateKey,
  isSameDay,
  isSameMonth,
} from "@/components/calendar/calendar-utils";

type CalendarDayProps = {
  date: Date;
  currentMonth: Date;
  appointments: CalendarAppointment[];
  selected: boolean;
  onSelectDate: (date: Date) => void;
};

const maximumVisibleAppointments = 3;

export default function CalendarDay({
  date,
  currentMonth,
  appointments,
  selected,
  onSelectDate,
}: CalendarDayProps) {
  const today = new Date();

  const belongsToCurrentMonth = isSameMonth(
    date,
    currentMonth,
  );

  const isToday = isSameDay(date, today);

  const visibleAppointments = appointments.slice(
    0,
    maximumVisibleAppointments,
  );

  const hiddenAppointmentCount =
    appointments.length - visibleAppointments.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectDate(date)}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onSelectDate(date);
        }
      }}
      className={`min-h-40 cursor-pointer border-b border-r border-gray-200 p-2.5 text-left transition hover:bg-gray-50 ${
        belongsToCurrentMonth
          ? "bg-white"
          : "bg-gray-50"
      } ${
        selected
          ? "ring-2 ring-inset ring-black"
          : ""
      }`}
      aria-label={`Select ${formatDateKey(date)}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            isToday
              ? "bg-black text-white"
              : belongsToCurrentMonth
                ? "text-gray-900"
                : "text-gray-400"
          }`}
        >
          {date.getDate()}
        </span>

        {appointments.length > 0 ? (
          <span className="text-xs font-medium text-gray-400">
            {appointments.length}
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1.5">
        {visibleAppointments.map(
          (appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              compact
            />
          ),
        )}

        {hiddenAppointmentCount > 0 ? (
          <p className="px-1 text-xs font-medium text-gray-500">
            +{hiddenAppointmentCount} more
          </p>
        ) : null}
      </div>
    </div>
  );
}
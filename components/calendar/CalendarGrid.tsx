import AppointmentCard from "@/components/calendar/AppointmentCard";
import type { CalendarAppointment } from "@/components/calendar/types";
import {
  formatDateKey,
  isSameDay,
  isSameMonth,
} from "@/components/calendar/calendar-utils";

const weekDays = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

type CalendarGridProps = {
  days: Date[];
  currentMonth: Date;
  selectedDate: Date | null;
  selectedAppointmentId: string | null;
  appointmentsByDate: Record<string, CalendarAppointment[]>;
  onSelectDate: (date: Date) => void;
  onSelectAppointment: (
    appointment: CalendarAppointment,
  ) => void;
};

export default function CalendarGrid({
  days,
  currentMonth,
  selectedDate,
  selectedAppointmentId,
  appointmentsByDate,
  onSelectDate,
  onSelectAppointment,
}: CalendarGridProps) {
  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((date) => {
            const dateKey = formatDateKey(date);
            const appointments =
              appointmentsByDate[dateKey] ?? [];

            const visibleAppointments = appointments.slice(0, 2);
            const remainingAppointments =
              appointments.length - visibleAppointments.length;

            const belongsToCurrentMonth = isSameMonth(
              date,
              currentMonth,
            );

            const isToday = isSameDay(date, today);

            const isSelected = selectedDate
              ? isSameDay(date, selectedDate)
              : false;

            return (
              <div
                key={dateKey}
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
                className={`min-h-36 cursor-pointer border-b border-r border-gray-200 p-3 text-left transition hover:bg-gray-50 ${
                  belongsToCurrentMonth
                    ? "bg-white"
                    : "bg-gray-50"
                } ${
                  isSelected
                    ? "ring-2 ring-inset ring-black"
                    : ""
                }`}
              >
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

                <div className="mt-3 space-y-2">
                  {visibleAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      compact
                      selected={
                        selectedAppointmentId === appointment.id
                      }
                      onSelect={onSelectAppointment}
                    />
                  ))}

                  {remainingAppointments > 0 ? (
                    <p className="text-xs font-medium text-gray-500">
                      +{remainingAppointments} more
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

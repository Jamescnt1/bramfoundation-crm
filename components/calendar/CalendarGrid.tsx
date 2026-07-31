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
  onCreateAppointment: (date: Date) => void;
};

export default function CalendarGrid({
  days,
  currentMonth,
  selectedDate,
  selectedAppointmentId,
  appointmentsByDate,
  onSelectDate,
  onSelectAppointment,
  onCreateAppointment,
}: CalendarGridProps) {
  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-0 sm:min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={`px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-2 sm:text-xs ${
                index === 0 || index === 6 ? "bg-slate-200/80 text-slate-700" : ""
              }`}
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
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <div
                key={dateKey}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDate(date)}
                onDoubleClick={(event) => {
                  if ((event.target as HTMLElement).closest("button, a")) return;
                  const appointmentDate = new Date(date);
                  appointmentDate.setHours(9, 0, 0, 0);
                  onCreateAppointment(appointmentDate);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    onSelectDate(date);
                  }
                }}
                className={`min-h-20 cursor-pointer border-b border-r border-gray-200 p-1 text-left transition hover:brightness-[0.98] sm:min-h-[4.75rem] sm:p-2 ${
                  belongsToCurrentMonth
                    ? isWeekend
                      ? "bg-slate-200/70"
                      : "bg-white"
                    : isWeekend
                      ? "bg-slate-100"
                      : "bg-gray-50"
                } ${
                  isSelected
                    ? "ring-2 ring-inset ring-black"
                    : ""
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium sm:h-8 sm:w-8 sm:text-sm ${
                    isToday
                      ? "bg-black text-white"
                      : belongsToCurrentMonth
                        ? "text-gray-900"
                        : "text-gray-400"
                  }`}
                >
                  {date.getDate()}
                </span>

                <div className="mt-1">
                  <div className="sm:hidden">
                    {appointments.length ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 py-0.5 text-[9px] font-bold text-white">
                        {appointments.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="hidden space-y-1 sm:block">
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

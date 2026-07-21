import AppointmentCard from "@/components/calendar/AppointmentCard";
import { formatDateKey, isSameDay } from "@/components/calendar/calendar-utils";
import type { CalendarAppointment } from "@/components/calendar/types";

type CalendarScheduleViewProps = {
  days: Date[];
  appointmentsByDate: Record<string, CalendarAppointment[]>;
  selectedAppointmentId: string | null;
  onSelectDate: (date: Date) => void;
  onSelectAppointment: (appointment: CalendarAppointment) => void;
};

export default function CalendarScheduleView({
  days,
  appointmentsByDate,
  selectedAppointmentId,
  onSelectDate,
  onSelectAppointment,
}: CalendarScheduleViewProps) {
  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[680px] divide-x divide-gray-200"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const appointments = appointmentsByDate[formatDateKey(day)] ?? [];
          const isToday = isSameDay(day, today);

          return (
            <section key={formatDateKey(day)} className="min-h-[620px] bg-white">
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={`w-full border-b border-gray-200 px-4 py-4 text-left transition hover:bg-gray-50 ${
                  isToday ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}
                </span>
                <span className="mt-1 block text-2xl font-semibold text-gray-900">
                  {day.getDate()}
                </span>
              </button>

              <div className="space-y-3 p-3">
                {appointments.length ? (
                  appointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      selected={selectedAppointmentId === appointment.id}
                      onSelect={onSelectAppointment}
                    />
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectDate(day)}
                    className="w-full rounded-lg border border-dashed border-gray-200 px-3 py-8 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600"
                  >
                    No appointments
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

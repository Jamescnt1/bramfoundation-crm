"use client";

import { useEffect, useMemo, useRef } from "react";
import AppointmentCard from "@/components/calendar/AppointmentCard";
import { formatDateKey, isSameDay } from "@/components/calendar/calendar-utils";
import type { CalendarAppointment } from "@/components/calendar/types";

type CalendarScheduleViewProps = {
  days: Date[];
  appointmentsByDate: Record<string, CalendarAppointment[]>;
  selectedAppointmentId: string | null;
  onSelectDate: (date: Date) => void;
  onSelectAppointment: (appointment: CalendarAppointment) => void;
  onCreateAppointment: (date: Date) => void;
};

type PositionedAppointment = {
  appointment: CalendarAppointment;
  startMinute: number;
  endMinute: number;
  lane: number;
  laneCount: number;
};

const HOUR_HEIGHT = 64;
const DAY_HEIGHT = HOUR_HEIGHT * 24;
const MORNING_SCROLL_HOUR = 7;
const hours = Array.from({ length: 24 }, (_, hour) => hour);

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function positionAppointments(
  appointments: CalendarAppointment[],
): PositionedAppointment[] {
  const entries = appointments
    .map((appointment) => {
      const start = new Date(appointment.starts_at);
      const end = new Date(appointment.ends_at ?? start.getTime() + 60 * 60 * 1000);
      const startMinute = minuteOfDay(start);
      const sameDay =
        start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === end.getDate();
      const endMinute = Math.max(
        startMinute + 15,
        sameDay ? minuteOfDay(end) : 24 * 60,
      );
      return {
        appointment,
        startMinute: Math.max(0, startMinute),
        endMinute: Math.min(24 * 60, endMinute),
      };
    })
    .sort(
      (first, second) =>
        first.startMinute - second.startMinute ||
        first.endMinute - second.endMinute,
    );

  const result: PositionedAppointment[] = [];
  let group: typeof entries = [];
  let groupEnd = -1;

  const flushGroup = () => {
    if (!group.length) return;
    const laneEnds: number[] = [];
    const positioned = group.map((entry) => {
      let lane = laneEnds.findIndex((end) => end <= entry.startMinute);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(entry.endMinute);
      } else {
        laneEnds[lane] = entry.endMinute;
      }
      return { ...entry, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);
    result.push(
      ...positioned.map((entry) => ({
        ...entry,
        laneCount,
      })),
    );
    group = [];
  };

  for (const entry of entries) {
    if (group.length && entry.startMinute >= groupEnd) {
      flushGroup();
      groupEnd = -1;
    }
    group.push(entry);
    groupEnd = Math.max(groupEnd, entry.endMinute);
  }
  flushGroup();
  return result;
}

export default function CalendarScheduleView({
  days,
  appointmentsByDate,
  selectedAppointmentId,
  onSelectDate,
  onSelectAppointment,
  onCreateAppointment,
}: CalendarScheduleViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const positionedByDate = useMemo(
    () =>
      Object.fromEntries(
        days.map((day) => {
          const key = formatDateKey(day);
          return [key, positionAppointments(appointmentsByDate[key] ?? [])];
        }),
      ),
    [appointmentsByDate, days],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = MORNING_SCROLL_HOUR * HOUR_HEIGHT;
  }, [days.length]);

  return (
    <div
      ref={scrollRef}
      className="max-h-[72dvh] overflow-auto bg-white"
      aria-label="Appointment time grid"
    >
      <div
        className={`relative ${
          days.length === 7
            ? "min-w-[700px] sm:min-w-[980px]"
            : days.length === 3
              ? "min-w-[520px] sm:min-w-[700px]"
              : "min-w-[300px] sm:min-w-[480px]"
        }`}
      >
        <div
          className="sticky top-0 z-30 grid border-b border-gray-200 bg-white shadow-sm"
          style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="border-r border-gray-200 bg-gray-50" />
          {days.map((day) => (
            <button
              key={formatDateKey(day)}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`border-r border-gray-200 px-3 py-2 text-center hover:bg-gray-50 ${
                isSameDay(day, today)
                  ? "bg-blue-50"
                  : day.getDay() === 0 || day.getDay() === 6
                    ? "bg-gray-100"
                    : "bg-white"
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}
              </span>
              <span className="mt-0.5 block text-lg font-semibold text-gray-900">
                {day.getDate()}
              </span>
            </button>
          ))}
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="relative border-r border-gray-200 bg-gray-50" style={{ height: DAY_HEIGHT }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-gray-500"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                }).format(new Date(2026, 0, 1, hour))}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = formatDateKey(day);
            const appointments = positionedByDate[key] ?? [];
            return (
              <div
                key={key}
                className={`relative border-r border-gray-200 ${
                  day.getDay() === 0 || day.getDay() === 6
                    ? "bg-[repeating-linear-gradient(to_bottom,#f3f4f6_0,#f3f4f6_31px,#e5e7eb_31px,#e5e7eb_32px,#f3f4f6_32px,#f3f4f6_63px,#c9cdd1_63px,#c9cdd1_64px)]"
                    : "bg-[repeating-linear-gradient(to_bottom,#ffffff_0,#ffffff_31px,#f3f4f6_31px,#f3f4f6_32px,#ffffff_32px,#ffffff_63px,#d1d5db_63px,#d1d5db_64px)]"
                }`}
                style={{ height: DAY_HEIGHT }}
                onDoubleClick={(event) => {
                  if ((event.target as HTMLElement).closest("button, a")) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const rawMinutes =
                    ((event.clientY - rect.top) / DAY_HEIGHT) * 24 * 60;
                  const roundedMinutes = Math.max(
                    0,
                    Math.min(23 * 60 + 45, Math.round(rawMinutes / 15) * 15),
                  );
                  const appointmentDate = new Date(day);
                  appointmentDate.setHours(
                    Math.floor(roundedMinutes / 60),
                    roundedMinutes % 60,
                    0,
                    0,
                  );
                  onSelectDate(appointmentDate);
                  onCreateAppointment(appointmentDate);
                }}
              >
                {appointments.map(
                  ({ appointment, startMinute, endMinute, lane, laneCount }) => {
                    const top = (startMinute / 60) * HOUR_HEIGHT;
                    const height = Math.max(
                      24,
                      ((endMinute - startMinute) / 60) * HOUR_HEIGHT,
                    );
                    const width = 100 / laneCount;
                    return (
                      <div
                        key={appointment.id}
                        className="absolute z-10 px-0.5 py-px"
                        style={{
                          top,
                          height,
                          left: `${lane * width}%`,
                          width: `${width}%`,
                        }}
                      >
                        <AppointmentCard
                          appointment={appointment}
                          showTime={false}
                          selected={selectedAppointmentId === appointment.id}
                          onSelect={onSelectAppointment}
                          className="h-full overflow-hidden"
                        />
                      </div>
                    );
                  },
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

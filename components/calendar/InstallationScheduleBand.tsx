import AppointmentTooltip from "@/components/calendar/AppointmentTooltip";
import { formatDateKey } from "@/components/calendar/calendar-utils";
import type { CalendarAppointment } from "@/components/calendar/types";
import {
  FALLBACK_INSTALLER_COLOR,
  getReadableTextColor,
  normalizeCalendarColor,
} from "@/components/calendar/appointment-appearance";
import { Hammer, X } from "lucide-react";

type InstallationScheduleBandProps = {
  days: Date[];
  appointments: CalendarAppointment[];
  selectedAppointmentId: string | null;
  onSelectAppointment: (appointment: CalendarAppointment) => void;
};

type InstallSegment = {
  appointment: CalendarAppointment;
  startColumn: number;
  endColumn: number;
  lane: number;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

function getInstallEnd(appointment: CalendarAppointment) {
  return startOfDay(new Date(appointment.ends_at ?? appointment.starts_at));
}

function formatInstallLabel(appointment: CalendarAppointment) {
  const installer = appointment.installer_crew?.name?.trim() || "Unassigned crew";
  const qfNumber = appointment.job?.qfloors_job_number?.trim();
  const qf = qfNumber ? `QF# ${qfNumber}` : "QF# —";
  const customer = appointment.job?.customer?.full_name?.trim() || "Customer unavailable";
  const job = appointment.job?.customer_name?.trim() || "Job unavailable";

  return `${installer} - ${qf} - ${customer} - ${job}`;
}

function formatCompactInstallLabel(appointment: CalendarAppointment, dayCount: number) {
  if (dayCount <= 7) return formatInstallLabel(appointment);
  const customer = appointment.job?.customer?.full_name?.trim() || "Customer";
  const job = appointment.job?.customer_name?.trim() || "Job";
  if (dayCount <= 14) return `${customer} - ${job}`;
  return appointment.job?.qfloors_job_number?.trim() ? `QF# ${appointment.job.qfloors_job_number}` : customer;
}

function formatDayHeading(day: Date, dayCount: number) {
  if (dayCount <= 7) return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "numeric", day: "numeric" }).format(day);
  if (dayCount <= 14) return new Intl.DateTimeFormat("en-US", { weekday: "narrow", month: "numeric", day: "numeric" }).format(day);
  return new Intl.DateTimeFormat("en-US", { weekday: "narrow", day: "numeric" }).format(day);
}

function buildSegments(
  days: Date[],
  appointments: CalendarAppointment[],
): InstallSegment[] {
  if (!days.length) return [];

  const rangeStart = startOfDay(days[0]);
  const rangeEnd = startOfDay(days[days.length - 1]);
  const laneEnds: number[] = [];

  return appointments
    .map((appointment) => ({
      appointment,
      start: startOfDay(new Date(appointment.starts_at)),
      end: getInstallEnd(appointment),
    }))
    .filter(({ start, end }) => start <= rangeEnd && end >= rangeStart)
    .sort((first, second) => {
      const startDifference = first.start.getTime() - second.start.getTime();
      return startDifference || second.end.getTime() - first.end.getTime();
    })
    .map(({ appointment, start, end }) => {
      const clippedStart = start < rangeStart ? rangeStart : start;
      const clippedEnd = end > rangeEnd ? rangeEnd : end;
      const startColumn = dayNumber(clippedStart) - dayNumber(rangeStart);
      const endColumn = dayNumber(clippedEnd) - dayNumber(rangeStart);
      let lane = laneEnds.findIndex((laneEnd) => startColumn > laneEnd);

      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(endColumn);
      } else {
        laneEnds[lane] = endColumn;
      }

      return { appointment, startColumn, endColumn, lane };
    });
}

export default function InstallationScheduleBand({
  days,
  appointments,
  selectedAppointmentId,
  onSelectAppointment,
}: InstallationScheduleBandProps) {
  const installAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_type === "installation" &&
      appointment.job?.installation_required !== false,
  );
  const segments = buildSegments(days, installAppointments);
  const laneCount = Math.max(1, ...segments.map((segment) => segment.lane + 1));
  const visibleInstallCount = installAppointments.filter((appointment) => {
    if (!days.length) return false;
    const start = startOfDay(new Date(appointment.starts_at));
    const end = getInstallEnd(appointment);
    return start <= startOfDay(days[days.length - 1]) && end >= startOfDay(days[0]);
  }).length;
  const density = days.length <= 7 ? "comfortable" : days.length <= 14 ? "compact" : "compressed";
  const fitClass = days.length <= 7 ? "min-w-[720px]" : days.length <= 14 ? "min-w-[700px] lg:min-w-0" : "min-w-[840px] lg:min-w-0";

  return (
    <section className="bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-300 px-3 py-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">
            Installation schedule
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Multi-day installation work
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-red-700"><X className="h-3.5 w-3.5 stroke-[3.5]" /> Work order needed</span>
          <span className="inline-flex items-center gap-1 text-green-700"><Hammer className="h-3.5 w-3.5 stroke-[3]" /> Sent</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-blue-800 ring-1 ring-blue-200">
            {visibleInstallCount} {visibleInstallCount === 1 ? "install" : "installs"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className={`w-full ${fitClass}`} data-density={density}>
          <div
            className="grid divide-x divide-slate-200 border-b border-slate-300 bg-white/70"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day) => (
              <div
                key={formatDateKey(day)}
                className={`${days.length <= 7 ? "px-2 py-2 text-[10px]" : days.length <= 14 ? "px-0.5 py-2 text-[9px]" : "px-0 py-2 text-[8px]"} min-w-0 text-center font-semibold text-slate-600 ${
                  day.getDay() === 0 || day.getDay() === 6 ? "bg-slate-200/80" : ""
                }`}
                title={new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(day)}
              >
                {days.length > 14 && day.getDate() === 1 ? <span className="block truncate font-bold text-blue-700">{new Intl.DateTimeFormat("en-US", { month: "short" }).format(day)}</span> : null}
                <span className="block truncate">{formatDayHeading(day, days.length)}</span>
              </div>
            ))}
          </div>

          <div
            className="grid gap-y-1.5 bg-[linear-gradient(to_right,rgba(100,116,139,0.18)_1px,transparent_1px)] px-1 py-2"
            style={{
              backgroundSize: `${100 / Math.max(days.length, 1)}% 100%`,
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${laneCount}, 30px)`,
            }}
          >
            {segments.length ? (
              segments.map((segment) => (
                <div
                  key={segment.appointment.id}
                  style={{
                    gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                    gridRow: segment.lane + 1,
                  }}
                  className="min-w-0 px-0.5"
                >
                  {(() => {
                    const backgroundColor = normalizeCalendarColor(
                      segment.appointment.installer_crew?.color,
                      FALLBACK_INSTALLER_COLOR,
                    );
                    const color = getReadableTextColor(backgroundColor);
                    const workOrderSent = ["sent", "acknowledged"].includes(segment.appointment.work_order_status);
                    return (
                  <AppointmentTooltip
                    appointment={segment.appointment}
                    displayName={formatInstallLabel(segment.appointment)}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAppointment(segment.appointment)}
                      style={{ backgroundColor, color }}
                      className={`flex h-7 w-full min-w-0 items-center rounded-md border border-blue-400 text-left font-semibold shadow-[inset_3px_0_0_rgba(219,234,254,0.95)] transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 ${days.length <= 7 ? "gap-1.5 px-2 text-[11px]" : days.length <= 14 ? "gap-1 px-1 text-[10px]" : "gap-0.5 px-0.5 text-[9px]"} ${
                        selectedAppointmentId === segment.appointment.id
                          ? "ring-2 ring-gray-950 ring-offset-1"
                          : ""
                      }`}
                    >
                      <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ${days.length <= 14 ? "h-5 w-5" : "h-4 w-4"} ${workOrderSent ? "text-green-700 ring-green-300" : "text-red-700 ring-red-300"}`} title={workOrderSent ? "Work order sent" : "Work order needs to be sent"}>
                        {workOrderSent
                          ? <Hammer className={`${days.length <= 14 ? "h-3.5 w-3.5" : "h-3 w-3"} stroke-[3]`} />
                          : <X className={`${days.length <= 14 ? "h-3.5 w-3.5" : "h-3 w-3"} stroke-[3.5]`} />}
                      </span>
                      <span className="truncate">
                        {formatCompactInstallLabel(segment.appointment, days.length)}
                      </span>
                    </button>
                  </AppointmentTooltip>
                    );
                  })()}
                </div>
              ))
            ) : (
              <p className="col-span-full self-center px-3 text-xs text-slate-600">
                No installations scheduled in this range.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

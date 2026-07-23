import AppointmentTooltip from "@/components/calendar/AppointmentTooltip";
import { formatDateKey } from "@/components/calendar/calendar-utils";
import type { CalendarAppointment } from "@/components/calendar/types";
import { formatAppointmentDisplayName } from "@/lib/appointment-display";

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
  return formatAppointmentDisplayName({
    appointmentType: appointment.appointment_type,
    customerName: appointment.job?.customer?.full_name,
    jobName: appointment.job?.customer_name,
  });
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

function getVisibleGroups(days: Date[]) {
  if (days.length <= 7) return [days];

  return Array.from(
    { length: Math.ceil(days.length / 7) },
    (_, index) => days.slice(index * 7, index * 7 + 7),
  );
}

export default function InstallationScheduleBand({
  days,
  appointments,
  selectedAppointmentId,
  onSelectAppointment,
}: InstallationScheduleBandProps) {
  const installAppointments = appointments.filter(
    (appointment) => appointment.appointment_type === "installation",
  );
  const groups = getVisibleGroups(days);
  const visibleInstallCount = installAppointments.filter((appointment) => {
    if (!days.length) return false;
    const start = startOfDay(new Date(appointment.starts_at));
    const end = getInstallEnd(appointment);
    return start <= startOfDay(days[days.length - 1]) && end >= startOfDay(days[0]);
  }).length;

  return (
    <section className="border-b border-emerald-200 bg-emerald-50/40">
      <div className="flex items-center justify-between border-b border-emerald-200 px-3 py-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-950">
            Installation schedule
          </h3>
          <p className="mt-0.5 text-[11px] text-emerald-800">
            Multi-day installation work
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
          {visibleInstallCount} {visibleInstallCount === 1 ? "install" : "installs"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className={days.length > 7 ? "min-w-[760px]" : "min-w-[680px]"}>
          {groups.map((group) => {
            const segments = buildSegments(group, installAppointments);
            const laneCount = Math.max(1, ...segments.map((segment) => segment.lane + 1));

            return (
              <div
                key={`${formatDateKey(group[0])}-${formatDateKey(group[group.length - 1])}`}
                className="border-b border-emerald-100 last:border-b-0"
              >
                <div
                  className="grid divide-x divide-emerald-100 bg-white/50"
                  style={{ gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))` }}
                >
                  {group.map((day) => (
                    <div key={formatDateKey(day)} className="px-2 py-1 text-center text-[10px] font-medium text-emerald-900/70">
                      {new Intl.DateTimeFormat("en-US", {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                      }).format(day)}
                    </div>
                  ))}
                </div>

                <div
                  className="grid gap-y-1 px-1 py-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${laneCount}, 26px)`,
                  }}
                >
                  {segments.length ? (
                    segments.map((segment) => (
                      <div
                        key={`${segment.appointment.id}-${formatDateKey(group[0])}`}
                        style={{
                          gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                          gridRow: segment.lane + 1,
                        }}
                        className="min-w-0 px-0.5"
                      >
                        <AppointmentTooltip appointment={segment.appointment}>
                          <button
                            type="button"
                            onClick={() => onSelectAppointment(segment.appointment)}
                            className={`h-6 w-full truncate rounded border border-emerald-300 bg-emerald-600 px-2 text-left text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-900 focus:ring-offset-1 ${
                              selectedAppointmentId === segment.appointment.id
                                ? "ring-2 ring-emerald-950 ring-offset-1"
                                : ""
                            }`}
                          >
                            {formatInstallLabel(segment.appointment)}
                          </button>
                        </AppointmentTooltip>
                      </div>
                    ))
                  ) : (
                    <p
                      className="col-span-full self-center px-2 text-[11px] text-emerald-800/70"
                      style={{ gridRow: 1 }}
                    >
                      No installations scheduled
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import AppointmentTooltip from "@/components/calendar/AppointmentTooltip";
import { formatDateKey } from "@/components/calendar/calendar-utils";
import type { CalendarAppointment } from "@/components/calendar/types";

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
    (appointment) => appointment.appointment_type === "installation",
  );
  const segments = buildSegments(days, installAppointments);
  const laneCount = Math.max(1, ...segments.map((segment) => segment.lane + 1));
  const visibleInstallCount = installAppointments.filter((appointment) => {
    if (!days.length) return false;
    const start = startOfDay(new Date(appointment.starts_at));
    const end = getInstallEnd(appointment);
    return start <= startOfDay(days[days.length - 1]) && end >= startOfDay(days[0]);
  }).length;

  return (
    <section className="bg-emerald-50/40">
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
        <div style={{ minWidth: `${Math.max(720, days.length * 96)}px` }}>
          <div
            className="grid divide-x divide-emerald-100 border-b border-emerald-200 bg-white/60"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day) => (
              <div
                key={formatDateKey(day)}
                className="px-2 py-2 text-center text-[10px] font-semibold text-emerald-900/70"
              >
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                }).format(day)}
              </div>
            ))}
          </div>

          <div
            className="grid gap-y-1.5 bg-[linear-gradient(to_right,rgba(16,185,129,0.12)_1px,transparent_1px)] px-1 py-2"
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
                  <AppointmentTooltip
                    appointment={segment.appointment}
                    displayName={formatInstallLabel(segment.appointment)}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAppointment(segment.appointment)}
                      className={`h-7 w-full truncate rounded-md border border-emerald-300 bg-emerald-600 px-2 text-left text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-900 focus:ring-offset-1 ${
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
              <p className="col-span-full self-center px-3 text-xs text-emerald-800/70">
                No installations scheduled in this range.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

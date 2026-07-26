"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import InstallationScheduleBand from "@/components/calendar/InstallationScheduleBand";
import { addDays, getConsecutiveDays } from "@/components/calendar/calendar-utils";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { InstallerCrew } from "@/lib/services/installer-crews";

type Props = {
  anchorDate: Date;
  rangeDays: number;
  installerCrewId: string;
  appointments: CalendarAppointment[];
  installerCrews: InstallerCrew[];
  selectedAppointmentId: string | null;
  onAnchorDateChange: (date: Date) => void;
  onRangeDaysChange: (days: number) => void;
  onInstallerCrewChange: (id: string) => void;
  onSelectAppointment: (appointment: CalendarAppointment) => void;
  onScheduleInstallation: () => void;
};

function formatRange(start: Date, count: number) {
  const end = addDays(start, count - 1);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export default function InstallScheduleView({
  anchorDate,
  rangeDays,
  installerCrewId,
  appointments,
  installerCrews,
  selectedAppointmentId,
  onAnchorDateChange,
  onRangeDaysChange,
  onInstallerCrewChange,
  onSelectAppointment,
  onScheduleInstallation,
}: Props) {
  const days = getConsecutiveDays(anchorDate, rangeDays);
  const installs = appointments.filter(
    (appointment) =>
      appointment.appointment_type === "installation" &&
      appointment.job?.installation_required !== false &&
      (!installerCrewId || appointment.installer_crew_id === installerCrewId),
  );

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAnchorDateChange(addDays(anchorDate, -rangeDays))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Previous date range"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onAnchorDateChange(new Date())}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onAnchorDateChange(addDays(anchorDate, rangeDays))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Next date range"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 text-lg font-semibold text-gray-950">
            {formatRange(anchorDate, rangeDays)}
          </h2>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Installer
            <select
              value={installerCrewId}
              onChange={(event) => onInstallerCrewChange(event.target.value)}
              className="h-9 min-w-40 rounded-md border border-gray-300 bg-white px-3 text-xs font-normal normal-case tracking-normal text-gray-800"
            >
              <option value="">All installers</option>
              {installerCrews.map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Date range
            <select
              value={rangeDays}
              onChange={(event) => onRangeDaysChange(Number(event.target.value))}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-xs font-normal normal-case tracking-normal text-gray-800"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={28}>28 days</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onScheduleInstallation}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Install
          </button>
        </div>
      </div>

      <InstallationScheduleBand
        days={days}
        appointments={installs}
        selectedAppointmentId={selectedAppointmentId}
        onSelectAppointment={onSelectAppointment}
      />
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import InstallationScheduleBand from "@/components/calendar/InstallationScheduleBand";
import { addDays, getConsecutiveDays, startOfWeek } from "@/components/calendar/calendar-utils";
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
  onScheduleInstall: () => void;
};

type RangeStart = "today" | "week";

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
  onScheduleInstall,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeStart, setRangeStart] = useState<RangeStart>("today");
  const days = getConsecutiveDays(anchorDate, rangeDays);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const installs = useMemo(() => appointments.filter(
      (appointment) =>
        appointment.appointment_type === "installation" &&
        appointment.job?.installation_required !== false &&
        (!installerCrewId || appointment.installer_crew_id === installerCrewId),
    ), [appointments, installerCrewId]);
  const matchingInstalls = useMemo(() => !normalizedSearch ? installs : installs
    .filter((appointment) => installSearchText(appointment).includes(normalizedSearch))
    .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime()), [installs, normalizedSearch]);

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAnchorDateChange(addDays(anchorDate, -7))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onAnchorDateChange(rangeStart === "week" ? startOfWeek(new Date()) : new Date())}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onAnchorDateChange(addDays(anchorDate, 7))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 text-lg font-semibold text-gray-950">
            {formatRange(anchorDate, rangeDays)}
          </h2>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-52 flex-1 gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 lg:max-w-72">
            Find installation
            <span className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Customer, job, QF#, address, crew…" className="h-9 w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-8 text-xs font-normal normal-case tracking-normal text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />{searchQuery ? <button type="button" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1.5 rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Clear installation search"><X className="h-4 w-4" /></button> : null}</span>
          </label>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Range starts
            <select
              value={rangeStart}
              onChange={(event) => {
                const nextRangeStart = event.target.value as RangeStart;
                setRangeStart(nextRangeStart);
                onAnchorDateChange(nextRangeStart === "week" ? startOfWeek(new Date()) : new Date());
              }}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-xs font-normal normal-case tracking-normal text-gray-800"
            >
              <option value="today">Today</option>
              <option value="week">Beginning of week</option>
            </select>
          </label>
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
            onClick={onScheduleInstall}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gray-950 px-3 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Install
          </button>
        </div>
      </div>

      {normalizedSearch ? <div className="border-b border-gray-200 bg-blue-50/60 px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-blue-950">{matchingInstalls.length} matching {matchingInstalls.length === 1 ? "installation" : "installations"}</p><button type="button" onClick={() => setSearchQuery("")} className="text-xs font-semibold text-blue-700 hover:underline">Clear search</button></div>{matchingInstalls.length ? <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">{matchingInstalls.slice(0, 9).map((appointment) => <button key={appointment.id} type="button" onClick={() => { const date = new Date(appointment.starts_at); onAnchorDateChange(rangeStart === "week" ? startOfWeek(date) : date); onSelectAppointment(appointment); }} className="rounded-md border border-blue-200 bg-white px-3 py-2 text-left hover:border-blue-400 hover:bg-blue-50"><span className="block truncate text-xs font-semibold text-gray-950">{installResultName(appointment)}</span><span className="mt-0.5 block text-[11px] text-gray-500">{formatInstallDate(appointment)} · {appointment.installer_crew?.name ?? "Unassigned crew"}</span></button>)}</div> : <p className="mt-2 text-xs text-blue-800">Try a customer, job, QF#, address, installation scope, or installer crew.</p>}{matchingInstalls.length > 9 ? <p className="mt-2 text-[11px] text-blue-800">Showing the first 9 matches. Add more detail to narrow the search.</p> : null}</div> : null}

      <InstallationScheduleBand
        days={days}
        appointments={matchingInstalls}
        selectedAppointmentId={selectedAppointmentId}
        onSelectAppointment={onSelectAppointment}
      />
    </>
  );
}

function installSearchText(appointment: CalendarAppointment) {
  return [appointment.job?.customer?.full_name, appointment.job?.customer_name, appointment.job?.project_customer_name,
    appointment.job?.qfloors_job_number, appointment.job?.address, appointment.installer_crew?.name,
    appointment.installation_scope, appointment.title].filter(Boolean).join(" ").toLocaleLowerCase();
}
function installResultName(appointment: CalendarAppointment) { const customer = appointment.job?.customer?.full_name ?? "Customer unavailable"; const job = appointment.job?.customer_name ?? "Job unavailable"; const qf = appointment.job?.qfloors_job_number ? ` · QF# ${appointment.job.qfloors_job_number}` : ""; return `${customer} · ${job}${qf}`; }
function formatInstallDate(appointment: CalendarAppointment) { const start = new Date(appointment.starts_at); const end = new Date(appointment.ends_at ?? appointment.starts_at); const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }); return start.toDateString() === end.toDateString() ? formatter.format(start) : `${formatter.format(start)} – ${formatter.format(end)}`; }

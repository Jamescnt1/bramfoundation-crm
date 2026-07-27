"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppointmentDetailsPanel from "@/components/calendar/AppointmentDetailsPanel";
import AppointmentDialog from "@/components/calendar/AppointmentDialog";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarListView from "@/components/calendar/CalendarListView";
import CalendarScheduleView from "@/components/calendar/CalendarScheduleView";
import CalendarToolbar from "@/components/calendar/CalendarToolbar";
import CalendarModeTabs, { type CalendarMode } from "@/components/calendar/CalendarModeTabs";
import DeleteAppointmentDialog from "@/components/calendar/DeleteAppointmentDialog";
import InstallScheduleView from "@/components/calendar/InstallScheduleView";
import {
  addDays,
  addMonths,
  addWeeks,
  formatDateKey,
  formatMonthHeading,
  getCalendarDays,
  getConsecutiveDays,
  startOfMonth,
  startOfWeek,
} from "@/components/calendar/calendar-utils";
import type { AppointmentType } from "@/components/calendar/constants";
import type { CalendarAppointment, CalendarView } from "@/components/calendar/types";
import { completeAppointment } from "@/lib/services/appointments";
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import CalendarFilters, { type CalendarFilterValues } from "@/components/calendar/CalendarFilters";

type CalendarBoardProps = {
  initialAppointments?: CalendarAppointment[];
  employees: Employee[];
  installerCrews: InstallerCrew[];
  jobs: Job[];
  initialAppointmentId?: string;
  initialDate?: string;
  initialMode?: CalendarMode;
  initialView?: CalendarView;
};

function getHeading(view: CalendarView, date: Date) {
  if (view === "month" || view === "list") return formatMonthHeading(date);

  const count = view === "week" ? 7 : view === "three_day" ? 3 : 1;
  const start = view === "week" ? startOfWeek(date) : date;
  const end = addDays(start, count - 1);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  if (count === 1) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export default function CalendarBoard({
  initialAppointments = [],
  employees,
  installerCrews,
  jobs,
  initialAppointmentId,
  initialDate,
  initialMode = "installs",
  initialView = "month",
}: CalendarBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const linkedAppointment = initialAppointmentId
    ? initialAppointments.find((appointment) => appointment.id === initialAppointmentId) ?? null
    : null;
  const linkedDate = linkedAppointment
    ? new Date(linkedAppointment.starts_at)
    : initialDate && !Number.isNaN(new Date(`${initialDate}T00:00:00`).getTime())
      ? new Date(`${initialDate}T00:00:00`)
      : new Date();
  const [mode, setMode] = useState<CalendarMode>(initialMode);
  const [view, setView] = useState<CalendarView>(initialView);
  const [anchorDate, setAnchorDate] = useState(() => linkedDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(linkedDate);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(linkedAppointment);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentBeingEdited, setAppointmentBeingEdited] = useState<CalendarAppointment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentBeingDeleted, setAppointmentBeingDeleted] = useState<CalendarAppointment | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [filters, setFilters] = useState<CalendarFilterValues>({
    employeeId: "", eventType: "", status: "", customerId: "", jobId: "",
  });
  const [defaultAppointmentType, setDefaultAppointmentType] = useState<AppointmentType>("appointment");
  const [installRangeDays, setInstallRangeDays] = useState(14);
  const [installerCrewId, setInstallerCrewId] = useState("");

  const filteredAppointments = useMemo(() => initialAppointments.filter((appointment) => {
    if (filters.employeeId && appointment.assigned_employee_id !== filters.employeeId) return false;
    if (filters.eventType && appointment.appointment_type !== filters.eventType) return false;
    if (filters.status && appointment.status !== filters.status) return false;
    if (filters.customerId && appointment.job?.customer_id !== filters.customerId) return false;
    if (filters.jobId && appointment.job_id !== filters.jobId) return false;
    return true;
  }), [initialAppointments, filters]);

  const timedAppointments = useMemo(
    () => filteredAppointments.filter(
      (appointment) => appointment.appointment_type !== "installation",
    ),
    [filteredAppointments],
  );

  function updateUrl(nextMode: CalendarMode, nextView: CalendarView = view) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextMode);
    if (nextMode === "appointments") params.set("view", nextView);
    else params.delete("view");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const month = useMemo(() => startOfMonth(anchorDate), [anchorDate]);
  const calendarDays = useMemo(() => getCalendarDays(month), [month]);
  const scheduleDays = useMemo(() => {
    if (view === "week") return getConsecutiveDays(startOfWeek(anchorDate), 7);
    if (view === "three_day") return getConsecutiveDays(anchorDate, 3);
    return getConsecutiveDays(anchorDate, 1);
  }, [anchorDate, view]);

  const appointmentsByDate = useMemo(() => {
    return timedAppointments.reduce<Record<string, CalendarAppointment[]>>(
      (result, appointment) => {
        const dateKey = formatDateKey(new Date(appointment.starts_at));
        result[dateKey] = [...(result[dateKey] ?? []), appointment].sort(
          (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        );
        return result;
      },
      {},
    );
  }, [timedAppointments]);

  function move(direction: -1 | 1) {
    setAnchorDate((date) => {
      if (view === "month" || view === "list") return addMonths(date, direction);
      if (view === "week") return addWeeks(date, direction);
      if (view === "three_day") return addDays(date, direction * 3);
      return addDays(date, direction);
    });
  }

  function handleToday() {
    const today = new Date();
    setAnchorDate(today);
    setSelectedDate(today);
    setSelectedAppointment(null);
  }

  function handleViewChange(nextView: CalendarView) {
    setView(nextView);
    updateUrl("appointments", nextView);
    if (selectedDate) setAnchorDate(selectedDate);
  }

  function handleModeChange(nextMode: CalendarMode) {
    setMode(nextMode);
    updateUrl(nextMode);
    const selectedIsInstallation = selectedAppointment?.appointment_type === "installation";
    if (
      selectedAppointment &&
      ((nextMode === "installs" && !selectedIsInstallation) ||
        (nextMode === "appointments" && selectedIsInstallation))
    ) {
      setSelectedAppointment(null);
    }
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setAnchorDate(date);
    setSelectedAppointment(null);
  }

  function handleSelectAppointment(appointment: CalendarAppointment) {
    const appointmentDate = new Date(appointment.starts_at);
    setSelectedDate(appointmentDate);
    setAnchorDate(appointmentDate);
    setSelectedAppointment(appointment);
    setActionError("");
  }

  async function handleCompleteAppointment(appointment: CalendarAppointment) {
    setIsCompleting(true);
    setActionError("");
    try {
      const completed = await completeAppointment(appointment.id);
      setSelectedAppointment(completed);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to complete appointment.");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <CalendarModeTabs value={mode} onChange={handleModeChange} />

          {mode === "installs" ? (
            <InstallScheduleView
              anchorDate={anchorDate}
              rangeDays={installRangeDays}
              installerCrewId={installerCrewId}
              appointments={initialAppointments}
              installerCrews={installerCrews}
              selectedAppointmentId={selectedAppointment?.id ?? null}
              onAnchorDateChange={(date) => {
                setAnchorDate(date);
                setSelectedDate(date);
              }}
              onRangeDaysChange={setInstallRangeDays}
              onInstallerCrewChange={setInstallerCrewId}
              onSelectAppointment={handleSelectAppointment}
              onScheduleInstall={() => {
                setDefaultAppointmentType("installation");
                setAppointmentBeingEdited(null);
                setAppointmentDialogOpen(true);
              }}
            />
          ) : (
            <>
              <CalendarToolbar
                heading={getHeading(view, anchorDate)}
                view={view}
                onViewChange={handleViewChange}
                onPrevious={() => move(-1)}
                onNext={() => move(1)}
                onToday={handleToday}
                onNewAppointment={() => {
                  setDefaultAppointmentType("appointment");
                  setAppointmentBeingEdited(null);
                  setAppointmentDialogOpen(true);
                }}
              />

              <CalendarFilters
                value={filters}
                employees={employees}
                jobs={jobs}
                includeInstallations={false}
                onChange={setFilters}
              />

              {view === "month" ? (
                <CalendarGrid
                  days={calendarDays}
                  currentMonth={month}
                  selectedDate={selectedDate}
                  selectedAppointmentId={selectedAppointment?.id ?? null}
                  appointmentsByDate={appointmentsByDate}
                  onSelectDate={handleSelectDate}
                  onSelectAppointment={handleSelectAppointment}
                />
              ) : view === "list" ? (
                <CalendarListView
                  appointments={timedAppointments}
                  selectedAppointmentId={selectedAppointment?.id ?? null}
                  onSelectAppointment={handleSelectAppointment}
                />
              ) : (
                <CalendarScheduleView
                  days={scheduleDays}
                  appointmentsByDate={appointmentsByDate}
                  selectedAppointmentId={selectedAppointment?.id ?? null}
                  onSelectDate={handleSelectDate}
                  onSelectAppointment={handleSelectAppointment}
                />
              )}
            </>
          )}
        </section>

        <AppointmentDetailsPanel
          appointment={selectedAppointment}
          selectedDate={selectedDate}
          employees={employees}
          installerCrews={installerCrews}
          isCompleting={isCompleting}
          actionError={actionError}
          onEditAppointment={(appointment) => {
            setAppointmentBeingEdited(appointment);
            setAppointmentDialogOpen(true);
          }}
          onCompleteAppointment={handleCompleteAppointment}
          onDeleteAppointment={(appointment) => {
            setAppointmentBeingDeleted(appointment);
            setDeleteDialogOpen(true);
          }}
        />
      </div>

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={(open) => {
          setAppointmentDialogOpen(open);
          if (!open) setAppointmentBeingEdited(null);
        }}
        defaultDate={selectedDate}
        appointment={appointmentBeingEdited}
        employees={employees}
        installerCrews={installerCrews}
        jobs={jobs}
        defaultAppointmentType={defaultAppointmentType}
      />

      <DeleteAppointmentDialog
        open={deleteDialogOpen}
        appointment={appointmentBeingDeleted}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setAppointmentBeingDeleted(null);
        }}
        onDeleted={() => {
          setSelectedAppointment(null);
          setAppointmentBeingDeleted(null);
        }}
      />
    </>
  );
}

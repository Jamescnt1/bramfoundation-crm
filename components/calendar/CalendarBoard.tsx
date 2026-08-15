"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppointmentDetailsPanel from "@/components/calendar/AppointmentDetailsPanel";
import AppointmentDialog from "@/components/calendar/AppointmentDialog";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarListView from "@/components/calendar/CalendarListView";
import CalendarScheduleView from "@/components/calendar/CalendarScheduleView";
import CalendarToolbar from "@/components/calendar/CalendarToolbar";
import CalendarViewOptions, {
  createEmptyCalendarFilters,
  type CalendarFilterValues,
  type CalendarViewOptionsValue,
} from "@/components/calendar/CalendarViewOptions";
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
import type { Employee } from "@/lib/services/employees";
import type { Job } from "@/lib/services/jobs";
import type { InstallerCrew } from "@/lib/services/installer-crews";
import {
  rememberCalendarViewAction,
  updateCalendarPreferencesAction,
} from "@/app/settings/calendar/actions";
import type { AppointmentTypeDefinition } from "@/lib/services/appointment-types";
import type { ProductionScopeOption } from "@/lib/services/production";
import type { CalendarCommunicationData } from "@/components/calendar/communication-types";

type CalendarBoardProps = {
  initialAppointments?: CalendarAppointment[];
  employees: Employee[];
  installerCrews: InstallerCrew[];
  jobs: Job[];
  initialAppointmentId?: string;
  initialDate?: string;
  initialMode?: CalendarMode;
  initialView?: CalendarView;
  initialDefaultView?: Exclude<CalendarView, "list">;
  rememberLastView?: boolean;
  currentEmployeeId: string;
  appointmentTypes: AppointmentTypeDefinition[];
  productionScopes: ProductionScopeOption[];
  appointmentScopeLinks: Record<string, string[]>;
  communication: CalendarCommunicationData;
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
  initialDefaultView = "month",
  rememberLastView = false,
  currentEmployeeId,
  appointmentTypes,
  productionScopes,
  appointmentScopeLinks,
  communication,
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
  const [filters, setFilters] = useState<CalendarFilterValues>(
    createEmptyCalendarFilters,
  );
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [defaultView, setDefaultView] = useState(initialDefaultView);
  const [rememberView, setRememberView] = useState(rememberLastView);
  const [defaultAppointmentType, setDefaultAppointmentType] = useState<AppointmentType>("appointment");
  const [installRangeDays, setInstallRangeDays] = useState(14);
  const [installerCrewId, setInstallerCrewId] = useState("");

  const filteredAppointments = useMemo(() => initialAppointments.filter((appointment) => {
    if (
      filters.employeeIds.length &&
      (!appointment.assigned_employee_id ||
        !filters.employeeIds.includes(appointment.assigned_employee_id))
    ) return false;
    if (
      filters.appointmentTypes.length &&
      (!appointment.appointment_type ||
        !filters.appointmentTypes.includes(appointment.appointment_type))
    ) return false;
    if (filters.status && appointment.status !== filters.status) return false;
    if (filters.customerId && appointment.job?.customer_id !== filters.customerId) return false;
    if (filters.jobId && appointment.job_id !== filters.jobId) return false;
    return true;
  }), [initialAppointments, filters]);

  const filterStorageKey = `foundation-calendar-filters:${currentEmployeeId}`;
  const viewStorageKey = `foundation-calendar-view:${currentEmployeeId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(filterStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<CalendarFilterValues>;
      const frame = window.requestAnimationFrame(() => {
        setFilters({
          employeeIds: Array.isArray(parsed.employeeIds)
            ? parsed.employeeIds.filter((id) =>
                employees.some((employee) => employee.id === id),
              )
            : [],
          appointmentTypes: Array.isArray(parsed.appointmentTypes)
            ? parsed.appointmentTypes.filter((type) =>
                appointmentTypes.some((definition) => definition.key === type),
              )
            : [],
          status: parsed.status ?? "",
          customerId: parsed.customerId ?? "",
          jobId: parsed.jobId ?? "",
        });
      });
      return () => window.cancelAnimationFrame(frame);
    } catch {
      window.localStorage.removeItem(filterStorageKey);
    }
  }, [appointmentTypes, employees, filterStorageKey]);

  useEffect(() => {
    if (!rememberView) return;
    const savedView = window.localStorage.getItem(viewStorageKey) as CalendarView | null;
    if (
      savedView &&
      ["month", "week", "three_day", "day", "list"].includes(savedView)
    ) {
      const frame = window.requestAnimationFrame(() => setView(savedView));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [rememberView, viewStorageKey]);

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

  function handleViewChange(
    nextView: CalendarView,
    shouldRemember = rememberView,
  ) {
    setView(nextView);
    if (shouldRemember) {
      window.localStorage.setItem(viewStorageKey, nextView);
    }
    updateUrl("appointments", nextView);
    if (selectedDate) setAnchorDate(selectedDate);
    if (shouldRemember && nextView !== "list") {
      void rememberCalendarViewAction(nextView).catch(() => {
        // View switching should remain responsive if preference persistence fails.
      });
    }
  }

  async function handleApplyViewOptions(next: CalendarViewOptionsValue) {
    const preferencesChanged =
      next.defaultView !== defaultView ||
      next.rememberLastView !== rememberView;

    if (preferencesChanged) {
      await updateCalendarPreferencesAction({
        defaultView: next.defaultView,
        rememberLastView: next.rememberLastView,
      });
      setDefaultView(next.defaultView);
      setRememberView(next.rememberLastView);
      if (next.rememberLastView) {
        window.localStorage.setItem(viewStorageKey, next.view);
        if (next.view !== "list") {
          await rememberCalendarViewAction(next.view);
        }
      } else {
        window.localStorage.removeItem(viewStorageKey);
      }
    }

    setFilters(next.filters);
    window.localStorage.setItem(filterStorageKey, JSON.stringify(next.filters));
    if (next.view !== view) handleViewChange(next.view, next.rememberLastView);
  }

  const activeFilterCount =
    filters.employeeIds.length +
    filters.appointmentTypes.length +
    Number(Boolean(filters.status)) +
    Number(Boolean(filters.customerId)) +
    Number(Boolean(filters.jobId));

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
  }

  function handleCreateAppointmentAt(date: Date) {
    setSelectedDate(date);
    setAnchorDate(date);
    setSelectedAppointment(null);
    setAppointmentBeingEdited(null);
    setDefaultAppointmentType("appointment");
    setAppointmentDialogOpen(true);
  }

  return (
    <>
      <div className="mt-3 grid gap-4 sm:mt-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
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
                activeFilterCount={activeFilterCount}
                onPrevious={() => move(-1)}
                onNext={() => move(1)}
                onToday={handleToday}
                onViewOptions={() => setViewOptionsOpen(true)}
                onNewAppointment={() => {
                  setDefaultAppointmentType("appointment");
                  setAppointmentBeingEdited(null);
                  setAppointmentDialogOpen(true);
                }}
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
                  onCreateAppointment={handleCreateAppointmentAt}
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
                  onCreateAppointment={handleCreateAppointmentAt}
                />
              )}
            </>
          )}
        </section>

        <div className="hidden xl:block">
          <AppointmentDetailsPanel
            appointment={selectedAppointment}
            selectedDate={selectedDate}
            employees={employees}
            installerCrews={installerCrews}
            communication={communication}
            onEditAppointment={(appointment) => {
              setAppointmentBeingEdited(appointment);
              setAppointmentDialogOpen(true);
            }}
            onDeleteAppointment={(appointment) => {
              setAppointmentBeingDeleted(appointment);
              setDeleteDialogOpen(true);
            }}
          />
        </div>
      </div>

      {selectedAppointment ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Appointment details"
          className="fixed inset-0 z-40 flex items-end bg-black/40 p-0 xl:hidden"
        >
          <button
            type="button"
            aria-label="Close appointment details"
            className="absolute inset-0"
            onClick={() => setSelectedAppointment(null)}
          />
          <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedAppointment(null)}
              className="sticky top-3 z-10 float-right mr-3 rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm"
              aria-label="Close appointment details"
            >
              <X className="h-4 w-4" />
            </button>
            <AppointmentDetailsPanel
              appointment={selectedAppointment}
              selectedDate={selectedDate}
              employees={employees}
              installerCrews={installerCrews}
              communication={communication}
              onEditAppointment={(appointment) => {
                setAppointmentBeingEdited(appointment);
                setAppointmentDialogOpen(true);
              }}
              onDeleteAppointment={(appointment) => {
                setAppointmentBeingDeleted(appointment);
                setDeleteDialogOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

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
        appointmentTypes={appointmentTypes}
        productionScopes={productionScopes}
        appointmentScopeIds={appointmentBeingEdited ? appointmentScopeLinks[appointmentBeingEdited.id] ?? [] : []}
        currentEmployeeId={currentEmployeeId}
      />

      {viewOptionsOpen ? (
        <CalendarViewOptions
          open
          value={{
            filters,
            view,
            defaultView,
            rememberLastView: rememberView,
          }}
          employees={employees}
          jobs={jobs}
          appointmentTypes={appointmentTypes}
          onOpenChange={setViewOptionsOpen}
          onApply={handleApplyViewOptions}
        />
      ) : null}

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

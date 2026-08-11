import CalendarBoard from "@/components/calendar/CalendarBoard";
import { getAppointmentsForCalendar } from "@/lib/services/appointments-server";
import { getActiveEmployees, requireEmployee } from "@/lib/services/employees";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { Employee } from "@/lib/services/employees";
import { getJobs, type Job } from "@/lib/services/jobs";
import { getActiveInstallerCrews, type InstallerCrew } from "@/lib/services/installer-crews";
import type { CalendarView } from "@/components/calendar/types";
import type { CalendarMode } from "@/components/calendar/CalendarModeTabs";
import {
  getAppointmentTypes,
  type AppointmentTypeDefinition,
} from "@/lib/services/appointment-types";
import { getAppointmentProductionScopeLinks, getProductionScopeOptions, type ProductionScopeOption } from "@/lib/services/production";
import PageHeader from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

type CalendarPageProps = {
  searchParams: Promise<{
    appointment?: string;
    date?: string;
    tab?: string;
    view?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const currentEmployee = await requireEmployee();
  const {
    appointment: initialAppointmentId,
    date: initialDate,
    tab,
    view,
  } = await searchParams;
  const initialMode: CalendarMode = tab === "installs" ? "installs" : "appointments";
  const calendarViews: CalendarView[] = ["month", "week", "three_day", "day", "list"];
  const requestedView = calendarViews.includes(view as CalendarView)
    ? (view as CalendarView)
    : null;
  const initialView = currentEmployee.remember_last_calendar_view
    ? requestedView ?? currentEmployee.last_calendar_view ?? currentEmployee.default_calendar_view
    : currentEmployee.default_calendar_view;
  let appointments: CalendarAppointment[] = [];
  let employees: Employee[] = [];
  let jobs: Job[] = [];
  let installerCrews: InstallerCrew[] = [];
  let appointmentTypes: AppointmentTypeDefinition[] = [];
  let errorMessage = "";
  let productionScopes: ProductionScopeOption[] = [];
  let appointmentScopeLinks: Record<string, string[]> = {};

  try {
    [appointments, employees, jobs, installerCrews, appointmentTypes] = await Promise.all([
      getAppointmentsForCalendar(),
      getActiveEmployees(),
      getJobs(),
      getActiveInstallerCrews(),
      getAppointmentTypes(),
    ]);
    [productionScopes, appointmentScopeLinks] = await Promise.all([
      getProductionScopeOptions(jobs.map((job) => job.id)),
      getAppointmentProductionScopeLinks(appointments.map((appointment) => appointment.id)),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load calendar.";
  }

  return (
    <main className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-5">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Calendar" description="Appointment scheduler" />
        {errorMessage ? (
          <div className="mt-6 rounded-lg bg-red-100 p-4 text-red-700">{errorMessage}</div>
        ) : (
          <CalendarBoard
            initialAppointments={appointments}
            employees={employees}
            installerCrews={installerCrews}
            jobs={jobs}
            initialAppointmentId={initialAppointmentId}
            initialDate={initialDate}
            initialMode={initialMode}
            initialView={initialView}
            initialDefaultView={currentEmployee.default_calendar_view}
            rememberLastView={currentEmployee.remember_last_calendar_view}
            currentEmployeeId={currentEmployee.id}
            appointmentTypes={appointmentTypes}
            productionScopes={productionScopes}
            appointmentScopeLinks={appointmentScopeLinks}
          />
        )}
      </div>
    </main>
  );
}

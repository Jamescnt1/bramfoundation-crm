import CalendarBoard from "@/components/calendar/CalendarBoard";
import { getAppointments } from "@/lib/services/appointments";
import { getActiveEmployees } from "@/lib/services/employees";
import type { CalendarAppointment } from "@/components/calendar/types";
import type { Employee } from "@/lib/services/employees";
import { getJobs, type Job } from "@/lib/services/jobs";
import { getActiveInstallerCrews, type InstallerCrew } from "@/lib/services/installer-crews";
import type { CalendarView } from "@/components/calendar/types";
import type { CalendarMode } from "@/components/calendar/CalendarModeTabs";

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
  const {
    appointment: initialAppointmentId,
    date: initialDate,
    tab,
    view,
  } = await searchParams;
  const initialMode: CalendarMode = tab === "appointments" ? "appointments" : "installs";
  const calendarViews: CalendarView[] = ["month", "week", "three_day", "day", "list"];
  const initialView = calendarViews.includes(view as CalendarView)
    ? (view as CalendarView)
    : "month";
  let appointments: CalendarAppointment[] = [];
  let employees: Employee[] = [];
  let jobs: Job[] = [];
  let installerCrews: InstallerCrew[] = [];
  let errorMessage = "";

  try {
    [appointments, employees, jobs, installerCrews] = await Promise.all([
      getAppointments(),
      getActiveEmployees(),
      getJobs(),
      getActiveInstallerCrews(),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load calendar.";
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header><h1 className="text-3xl font-bold">Calendar</h1><p className="mt-2 text-gray-600">Appointment Scheduler</p></header>
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
          />
        )}
      </div>
    </main>
  );
}

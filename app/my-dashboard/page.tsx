import Link from "next/link";
import { requireEmployee } from "@/lib/services/employees";
import { getEmployeeWorkspace } from "@/lib/services/workspace";
import { resolveConfiguredStage } from "@/components/pipeline/constants";
import { getPipelineStages } from "@/lib/services/pipeline-stages";
import InternalMessagesDashboard from "@/components/messaging/InternalMessagesDashboard";
import { getEmployeeConversations, getMessagingEmployees } from "@/lib/services/internal-messaging";
import { formatAppointmentDisplayName } from "@/lib/appointment-display";
import CompactPipelineOverview from "@/components/dashboard/CompactPipelineOverview";
import MyTaskPanel from "@/components/dashboard/MyTaskPanel";
import { getCompanySettings } from "@/lib/services/company-settings";
import { dateKeyInTimeZone, formatAppointmentDateTime } from "@/lib/date-time";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const employee = await requireEmployee();
  const [workspace, stages, conversations, messagingEmployees, companySettings] = await Promise.all([getEmployeeWorkspace(employee), getPipelineStages(), getEmployeeConversations(), getMessagingEmployees(), getCompanySettings()]);
  const pipelineGroups = stages.map((stage) => ({
    stage,
    jobs: workspace.jobs.filter(
      (job) => resolveConfiguredStage(job.status, stages)?.slug === stage.slug,
    ),
  }));

  return (
    <main className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-gray-50 p-4 md:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <header>
          <div>
            <p className="text-sm font-medium text-gray-500">My Workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Welcome, {employee.name}</h1>
            <p className="mt-1 text-sm text-gray-600">Your assigned work, schedule, and pipeline at a glance.</p>
          </div>
        </header>

        <section className="relative z-30 mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-base font-semibold">My Jobs &amp; Pipeline</h2><p className="mt-0.5 text-xs text-gray-500">Hover, focus, or tap a stage to see its assigned jobs.</p></div>
            <Link href="/pipeline" className="shrink-0 text-sm font-medium text-gray-500 hover:text-black">Open pipeline →</Link>
          </div>
          <div className="mt-3">
            <CompactPipelineOverview groups={pipelineGroups} />
          </div>
        </section>

        <div className="mt-3 grid min-w-0 items-start gap-3 xl:grid-cols-3">
          <WorkspaceSection title="My Tasks" href="/tasks?view=mine">
            <MyTaskPanel initialTasks={workspace.tasks} timeZone={companySettings.timezone} />
          </WorkspaceSection>

          <WorkspaceSection title="Upcoming Appointments" href="/calendar">
            {workspace.appointments.length ? (
              <div className="divide-y divide-gray-100">
                {workspace.appointments.slice(0, 8).map((appointment) => {
                  const isInstallation = appointment.appointment_type === "installation";
                  return (
                  <Link key={appointment.id} href={`/calendar?appointment=${appointment.id}&date=${dateKeyInTimeZone(appointment.starts_at, companySettings.timezone)}`} className={`block border-l-4 py-2 pr-1 pl-3 transition ${isInstallation ? "border-amber-500 bg-amber-50/70 hover:bg-amber-100/70" : "border-transparent hover:bg-gray-50"}`}>
                    <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate font-medium text-gray-900">{formatAppointmentDisplayName({ appointmentType: appointment.appointment_type, customerName: appointment.job?.customer?.full_name, jobName: appointment.job?.customer_name })}</p>
                          {isInstallation ? <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">Installation</span> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">{appointment.job?.qfloors_job_number ? `QF# ${appointment.job.qfloors_job_number}` : ""}</p>
                      </div>
                      <time className="max-w-28 shrink-0 text-right text-xs leading-4 font-medium text-gray-600">{formatAppointmentDateTime(appointment.starts_at, companySettings.timezone)}</time>
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-500">{appointment.location ?? "No location"}</p>
                  </Link>
                  );
                })}
              </div>
            ) : <EmptyText text="No appointments assigned in the next 14 days." />}
          </WorkspaceSection>

          <div className="w-full min-w-0 max-w-full overflow-hidden">
            <InternalMessagesDashboard initialConversations={conversations} currentEmployee={{ id: employee.id, name: employee.name, avatar_url: employee.avatar_url, color: employee.color }} employees={messagingEmployees} />
          </div>

        </div>
      </div>
    </main>
  );
}

function WorkspaceSection({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-center justify-between gap-2"><h2 className="min-w-0 truncate text-base font-semibold">{title}</h2><Link href={href} className="shrink-0 text-xs font-medium text-gray-500 hover:text-black">View all →</Link></div><div className="mt-2 min-w-0">{children}</div></section>;
}

function EmptyText({ text }: { text: string }) { return <p className="py-6 text-sm text-gray-500">{text}</p>; }

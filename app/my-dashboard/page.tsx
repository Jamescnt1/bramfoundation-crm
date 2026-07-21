import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireEmployee } from "@/lib/services/employees";
import { getEmployeeWorkspace } from "@/lib/services/workspace";
import {
  getStageStyles,
  resolveConfiguredStage,
} from "@/components/pipeline/constants";
import { formatJobDisplayName } from "@/lib/job-display";
import { getPipelineStages } from "@/lib/services/pipeline-stages";
import InternalMessagesDashboard from "@/components/messaging/InternalMessagesDashboard";
import { getEmployeeConversations, getMessagingEmployees } from "@/lib/services/internal-messaging";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const employee = await requireEmployee();
  const [workspace, stages, conversations, messagingEmployees] = await Promise.all([getEmployeeWorkspace(employee), getPipelineStages(), getEmployeeConversations(), getMessagingEmployees()]);
  const openTasks = workspace.tasks.filter((task) => !task.completed);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">My Workspace</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome, {employee.name}</h1>
            <p className="mt-2 text-gray-600">Your assigned work, schedule, and pipeline at a glance.</p>
          </div>

          <Link
            href="/leads/new"
            className={buttonVariants({
              size: "lg",
              className: "h-11 w-full gap-2 px-5 text-base shadow-sm sm:w-auto",
            })}
          >
            <Plus className="size-5" aria-hidden="true" />
            New Lead
          </Link>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <WorkspaceSection title="My Tasks" href="/tasks?view=mine">
            {openTasks.length ? (
              <div className="divide-y divide-gray-100">
                {openTasks.slice(0, 8).map((task) => (
                  <Link key={task.id} href={`/tasks?task=${task.id}`} className="grid gap-2 py-3 transition hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{task.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{task.jobs ? formatJobDisplayName({ customerName: task.jobs.customer?.full_name ?? task.customers?.full_name, jobName: task.jobs.customer_name, qfNumber: task.jobs.qfloors_job_number }) : task.customers?.full_name ?? "Business task"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end">
                      <TaskBadge value={task.priority} priority />
                      <TaskBadge value={task.status} />
                      <span className="text-gray-500">{formatTaskDue(task.due_at, task.due_date)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <EmptyText text="No open tasks assigned to you." />}
          </WorkspaceSection>

          <WorkspaceSection title="Upcoming Appointments" href="/calendar">
            {workspace.appointments.length ? (
              <div className="divide-y divide-gray-100">
                {workspace.appointments.slice(0, 8).map((appointment) => (
                  <Link key={appointment.id} href={`/calendar?appointment=${appointment.id}&date=${localDateKey(new Date(appointment.starts_at))}`} className="block py-3 transition hover:bg-gray-50 sm:px-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{appointment.title}</p>
                        <p className="mt-1 text-sm text-gray-500">{appointment.job ? formatJobDisplayName({ customerName: appointment.job.customer?.full_name, jobName: appointment.job.customer_name, qfNumber: appointment.job.qfloors_job_number }) : "No customer or job linked"}</p>
                      </div>
                      <time className="shrink-0 text-right text-xs font-medium text-gray-600">{formatAppointmentDate(appointment.starts_at)}</time>
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-500">{appointment.location ?? "No location"}</p>
                  </Link>
                ))}
              </div>
            ) : <EmptyText text="No appointments assigned in the next 14 days." />}
          </WorkspaceSection>

          <InternalMessagesDashboard initialConversations={conversations} currentEmployee={{ id: employee.id, name: employee.name, avatar_url: employee.avatar_url, color: employee.color }} employees={messagingEmployees} />

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="text-xl font-semibold">My Jobs &amp; Pipeline</h2><p className="mt-1 text-sm text-gray-500">Assigned jobs grouped by their current pipeline stage.</p></div>
              <Link href="/pipeline" className="shrink-0 text-sm font-medium text-gray-500 hover:text-black">Open pipeline →</Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {stages.map((stage) => {
                const jobs = workspace.jobs.filter((job) => resolveConfiguredStage(job.status, stages)?.slug === stage.slug);
                const styles = getStageStyles(stage);
                return (
                  <div key={stage.slug} className={`overflow-hidden rounded-xl border bg-white ${styles.border}`}>
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                      <h3 className={`font-semibold ${styles.badge}`.split(" ").find((name) => name.startsWith("text-"))}>{stage.label}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>{jobs.length}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {jobs.length ? jobs.map((job) => (
                        <Link key={job.id} href={`/leads/${job.id}`} className="block px-4 py-3 text-sm transition hover:bg-gray-50">
                          <p className="font-medium text-gray-900">{formatJobDisplayName({ customerName: job.customer?.full_name, jobName: job.customer_name, qfNumber: job.qfloors_job_number })}</p>
                          {job.next_action ? <p className="mt-1 truncate text-xs text-gray-500">Next: {job.next_action}</p> : null}
                        </Link>
                      )) : <p className="px-4 py-5 text-sm text-gray-400">No assigned jobs</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function WorkspaceSection({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><Link href={href} className="text-sm font-medium text-gray-500 hover:text-black">View all →</Link></div><div className="mt-4">{children}</div></section>;
}

function EmptyText({ text }: { text: string }) { return <p className="py-6 text-sm text-gray-500">{text}</p>; }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function label(value: string) { return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "); }
function TaskBadge({ value, priority = false }: { value: string; priority?: boolean }) {
  const color = priority && value === "urgent" ? "bg-red-50 text-red-700" : priority && value === "high" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600";
  return <span className={`rounded-full px-2 py-0.5 font-semibold ${color}`}>{label(value)}</span>;
}
function formatTaskDue(dueAt: string | null, dueDate: string | null) {
  if (dueAt) return new Date(dueAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (dueDate) return new Date(`${dueDate}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
  return "No due date";
}
function formatAppointmentDate(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

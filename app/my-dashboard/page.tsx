import Link from "next/link";
import { requireEmployee } from "@/lib/services/employees";
import { getEmployeeWorkspace } from "@/lib/services/workspace";
import { resolveConfiguredStage } from "@/components/pipeline/constants";
import { getPipelineStages } from "@/lib/services/pipeline-stages";
import InternalMessagesDashboard from "@/components/messaging/InternalMessagesDashboard";
import { getEmployeeConversations, getMessagingEmployees } from "@/lib/services/internal-messaging";
import CompactPipelineOverview from "@/components/dashboard/CompactPipelineOverview";
import MyTaskPanel from "@/components/dashboard/MyTaskPanel";
import DashboardScheduleList from "@/components/dashboard/DashboardScheduleList";
import { getCompanySettings } from "@/lib/services/company-settings";
import CustomerEmailRepliesCard from "@/components/dashboard/CustomerEmailRepliesCard";
import { getMyCustomerEmailReplies } from "@/lib/services/customer-email";
import PageHeader from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function MyDashboardPage() {
  const employee = await requireEmployee();
  const [workspace, stages, conversations, messagingEmployees, companySettings, customerEmailReplies] = await Promise.all([getEmployeeWorkspace(employee), getPipelineStages(), getEmployeeConversations(), getMessagingEmployees(), getCompanySettings(), getMyCustomerEmailReplies()]);
  const pipelineGroups = stages.map((stage) => ({
    stage,
    jobs: workspace.jobs.filter(
      (job) => resolveConfiguredStage(job.status, stages)?.slug === stage.slug,
    ),
  }));

  return (
    <main className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-gray-50 p-4 md:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <PageHeader compact eyebrow="My Workspace" title={`Welcome, ${employee.name}`} description="Your assigned work, schedule, and pipeline at a glance." />

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

          <div className="grid min-w-0 gap-3">
            <WorkspaceSection title="Upcoming Appointments" href="/calendar">
              <DashboardScheduleList appointments={workspace.appointments} timeZone={companySettings.timezone} />
            </WorkspaceSection>
            <WorkspaceSection title="Current & Upcoming Installs" href="/calendar?tab=installs">
              <DashboardScheduleList appointments={workspace.installations} timeZone={companySettings.timezone} installations />
            </WorkspaceSection>
          </div>

          <div className="w-full min-w-0 max-w-full overflow-hidden">
            <div className="grid gap-3">
              <CustomerEmailRepliesCard initialReplies={customerEmailReplies} />
              <InternalMessagesDashboard initialConversations={conversations} currentEmployee={{ id: employee.id, name: employee.name, avatar_url: employee.avatar_url, color: employee.color }} employees={messagingEmployees} />
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

function WorkspaceSection({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-center justify-between gap-2"><h2 className="min-w-0 truncate text-base font-semibold">{title}</h2><Link href={href} className="shrink-0 text-xs font-medium text-gray-500 hover:text-black">View all →</Link></div><div className="mt-2 min-w-0">{children}</div></section>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChartNoAxesCombined, Plus, Rows3 } from "lucide-react";
import AttentionList from "@/components/dashboard/AttentionList";
import DashboardSection from "@/components/dashboard/DashboardSection";
import EmployeeAccountabilityTable from "@/components/dashboard/EmployeeAccountabilityTable";
import OperationalMetrics from "@/components/dashboard/OperationalMetrics";
import PipelineHealth from "@/components/dashboard/PipelineHealth";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import SalesPerformanceTable from "@/components/dashboard/SalesPerformanceTable";
import WorkloadBalance from "@/components/dashboard/WorkloadBalance";
import { buttonVariants } from "@/components/ui/button";
import { canViewCompanyDashboard } from "@/lib/auth/roles";
import { getCompanyDashboardData } from "@/lib/services/company-dashboard";
import { requireEmployee } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage() {
  const employee = await requireEmployee();
  if (!canViewCompanyDashboard(employee.role)) redirect("/my-dashboard");

  const data = await getCompanyDashboardData();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-sm font-medium text-gray-500">Management Command Center</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">Company Dashboard</h1><p className="mt-2 max-w-2xl text-gray-600">What requires management attention today across sales, scheduling, and operations.</p></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/leads/new" className={buttonVariants({ size: "lg", className: "h-11 gap-2 px-5 shadow-sm" })}><Plus className="size-5" />New Lead</Link>
            <QuickLink href="/pipeline" icon={<Rows3 className="size-4" />}>Pipeline</QuickLink>
            <QuickLink href="/calendar" icon={<CalendarDays className="size-4" />}>Calendar</QuickLink>
            <QuickLink href="/reports" icon={<ChartNoAxesCombined className="size-4" />}>Reports</QuickLink>
          </div>
        </header>

        <OperationalMetrics metrics={[
          { label: "Today's Leads", value: data.snapshot.todayLeads, href: "/leads" },
          { label: "Measures Today", value: data.snapshot.measuresToday, href: `/calendar?date=${localDateKey(new Date())}` },
          { label: "Installs Today", value: data.snapshot.installsToday, href: `/calendar?date=${localDateKey(new Date())}` },
          { label: "Overdue Tasks", value: data.snapshot.overdueTasks, href: "/tasks?view=overdue", tone: data.snapshot.overdueTasks ? "red" : "default" },
          { label: "Waiting Approval", value: data.snapshot.waitingApproval, href: "/pipeline?stage=Waiting%20Approval", tone: data.snapshot.waitingApproval ? "amber" : "default" },
        ]} />

        <DashboardSection className="mt-6" title="Employee Accountability" description="Workload, overdue commitments, and daily activity by employee.">
          <EmployeeAccountabilityTable rows={data.accountability} />
        </DashboardSection>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <DashboardSection title="Needs Attention" description={`Exceptions requiring action. Follow-up threshold: ${data.thresholds.followUpDays} days.`} href="/tasks"><AttentionList items={data.attentionItems.slice(0, 14)} /></DashboardSection>
          <DashboardSection title="Needs My Attention" description="Management-only blockers and administrative follow-up." href="/settings"><AttentionList items={data.managementItems} emptyText="No management blockers detected." /></DashboardSection>
        </div>

        <DashboardSection className="mt-6" title="Pipeline Health" description="Actual jobs grouped by stage, using the shared pipeline color system." href="/pipeline" linkLabel="Open full pipeline →">
          <PipelineHealth pipeline={data.pipeline} stages={data.stages} />
        </DashboardSection>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <DashboardSection title="Recent Activity" description="Latest job and workflow events across the company."><RecentActivityFeed items={data.recentActivity} /></DashboardSection>
          <DashboardSection title="Workload Balance" description="Active jobs plus open tasks by employee."><WorkloadBalance rows={data.workload} /></DashboardSection>
        </div>

        <DashboardSection className="mt-6" title="Sales Performance" description="Current workflow throughput by employee—not revenue reporting." href="/reports">
          <SalesPerformanceTable rows={data.salesPerformance} />
        </DashboardSection>
      </div>
    </main>
  );
}

function QuickLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-black">{icon}{children}</Link>;
}

function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

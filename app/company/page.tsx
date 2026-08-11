import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChartNoAxesCombined, Rows3 } from "lucide-react";
import AttentionList from "@/components/dashboard/AttentionList";
import DashboardSection from "@/components/dashboard/DashboardSection";
import EmployeeAccountabilityTable from "@/components/dashboard/EmployeeAccountabilityTable";
import OperationalMetrics from "@/components/dashboard/OperationalMetrics";
import PipelineHealth from "@/components/dashboard/PipelineHealth";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import SalesPerformanceTable from "@/components/dashboard/SalesPerformanceTable";
import WorkloadBalance from "@/components/dashboard/WorkloadBalance";
import { canViewCompanyDashboard } from "@/lib/auth/roles";
import { getCompanyDashboardData } from "@/lib/services/company-dashboard";
import { requireEmployee } from "@/lib/services/employees";
import PageHeader from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage() {
  const employee = await requireEmployee();
  if (!canViewCompanyDashboard(employee.role)) redirect("/my-dashboard");

  const data = await getCompanyDashboardData(employee);
  const attentionItems = combineAttentionItems(data.attentionItems, data.managementItems);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader eyebrow="Management Command Center" title="Company Dashboard" description="What requires management attention today across sales, scheduling, and operations." actions={<>
            <QuickLink href="/pipeline" icon={<Rows3 className="size-4" />}>Pipeline</QuickLink>
            <QuickLink href="/calendar" icon={<CalendarDays className="size-4" />}>Calendar</QuickLink>
            <QuickLink href="/reports" icon={<ChartNoAxesCombined className="size-4" />}>Reports</QuickLink>
          </>} />

        <OperationalMetrics metrics={[
          { label: "Today's Leads", value: data.snapshot.todayLeads, href: "/leads" },
          { label: "Measures Today", value: data.snapshot.measuresToday, href: `/calendar?date=${localDateKey(new Date())}` },
          { label: "Installs Today", value: data.snapshot.installsToday, href: `/calendar?date=${localDateKey(new Date())}` },
          { label: "Overdue Tasks", value: data.snapshot.overdueTasks, href: "/tasks?view=overdue", tone: data.snapshot.overdueTasks ? "red" : "default" },
          { label: "Waiting Approval", value: data.snapshot.waitingApproval, href: "/pipeline?stage=Waiting%20Approval", tone: data.snapshot.waitingApproval ? "amber" : "default" },
        ]} />

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">
          <DashboardSection title="Sales Performance" description="Current workflow throughput by employee." href="/reports"><SalesPerformanceTable rows={data.salesPerformance} compact /></DashboardSection>
          <DashboardSection title="Workload Balance" description="Active jobs plus open tasks by employee."><div className="max-h-[22rem] overflow-y-auto pr-1"><WorkloadBalance rows={data.workload} /></div></DashboardSection>
          <DashboardSection title="Employee Accountability" description="Commitments and daily activity by employee."><EmployeeAccountabilityTable rows={data.accountability} compact /></DashboardSection>
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <DashboardSection title="Recent Activity" description="Latest job and workflow events across the company."><div className="max-h-[24rem] overflow-y-auto pr-1"><RecentActivityFeed items={data.recentActivity} /></div></DashboardSection>
          <DashboardSection title="Needs Attention" description={`Priority exceptions and assigned items. Inactivity: ${data.thresholds.noActivityDays} days.`} href="/settings/company-dashboard" linkLabel="Rules →"><div className="max-h-[24rem] overflow-y-auto pr-1"><AttentionList items={attentionItems} /></div></DashboardSection>
        </div>

        <DashboardSection className="mt-4" title="Pipeline Health" description="Actual jobs grouped by stage, using the shared pipeline color system." href="/pipeline" linkLabel="Open full pipeline →">
          <PipelineHealth pipeline={data.pipeline} stages={data.stages} />
        </DashboardSection>
      </div>
    </main>
  );
}

function QuickLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-black">{icon}{children}</Link>;
}

function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

function combineAttentionItems<T extends { id: string; kind: string; href: string; title: string }>(companyItems: T[], personalItems: T[]) {
  const companyHrefs = new Set(companyItems.map((item) => item.href));
  const seen = new Set<string>();
  return [...companyItems, ...personalItems]
    .filter((item) => {
      if ((item.kind === "jobs_assigned_to_me" || item.kind === "tasks_assigned_to_me") && companyHrefs.has(item.href)) return false;
      const normalizedTitle = item.title.replace(/^My /, "");
      const key = `${item.href}:${normalizedTitle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}

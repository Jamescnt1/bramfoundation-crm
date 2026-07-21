import type { CompanyDashboardData } from "@/lib/services/company-dashboard";

export default function WorkloadBalance({ rows }: { rows: CompanyDashboardData["workload"] }) {
  const maximum = Math.max(1, ...rows.map((row) => row.total));
  return <div className="space-y-4">{rows.map((row) => <div key={row.employee.id}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-gray-900">{row.employee.name}</span><span className="text-xs text-gray-500">{row.activeJobs} jobs · {row.openTasks} tasks</span></div><div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, (row.total / maximum) * 100)}%`, backgroundColor: row.employee.color || "#111827" }} /></div></div>)}</div>;
}

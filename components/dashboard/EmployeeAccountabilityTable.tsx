import Link from "next/link";
import type { AccountabilityRow } from "@/lib/services/company-dashboard";

const healthStyles = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

export default function EmployeeAccountabilityTable({ rows }: { rows: AccountabilityRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
          <tr><th className="pb-3 font-semibold">Employee</th><th className="pb-3 text-right font-semibold">Open Tasks</th><th className="pb-3 text-right font-semibold">Overdue</th><th className="pb-3 text-right font-semibold">Active Jobs</th><th className="pb-3 text-right font-semibold">Measures Today</th><th className="pb-3 text-right font-semibold">Last Activity</th><th className="pb-3 text-right font-semibold">Health</th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="py-3 pr-4"><Link href={`/my-dashboard?employee=${row.id}`} className="font-semibold text-gray-950 hover:underline">{row.name}</Link><p className="mt-0.5 text-xs text-gray-500">{roleLabel(row.role)}</p></td>
              <td className="py-3 text-right font-medium">{row.openTasks}</td>
              <td className={`py-3 text-right font-semibold ${row.overdueTasks ? "text-red-700" : "text-gray-600"}`}>{row.overdueTasks}</td>
              <td className="py-3 text-right font-medium">{row.activeJobs}</td>
              <td className="py-3 text-right font-medium">{row.measuresToday}</td>
              <td className="py-3 text-right text-gray-500">{relativeTime(row.lastActivity)}</td>
              <td className="py-3 text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${healthStyles[row.health]}`}>{row.health}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function roleLabel(role: string) { return role.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "); }
function relativeTime(value: string | null) {
  if (!value) return "No activity";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

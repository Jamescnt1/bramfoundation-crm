import { redirect } from "next/navigation";
import { canViewCompanyDashboard } from "@/lib/auth/roles";
import { requireEmployee } from "@/lib/services/employees";

export default async function DashboardRouterPage() {
  const employee = await requireEmployee();
  redirect(canViewCompanyDashboard(employee.role) ? "/company" : "/my-dashboard");
}

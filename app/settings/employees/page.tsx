import EmployeesManager from "@/components/settings/EmployeesManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getManagedEmployees } from "@/lib/services/employee-admin";
import { hasPermission, requireAdministrator } from "@/lib/services/employees";
import { getRolesAndPermissions } from "@/lib/services/roles-admin";

export const dynamic = "force-dynamic";

export default async function EmployeesSettingsPage() {
  await requireAdministrator();
  const [employees, roleData, canDeactivateEmployees] = await Promise.all([
    getManagedEmployees(),
    getRolesAndPermissions(),
    hasPermission("delete_employees"),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <SettingsPageHeader
          title="Employees & Access"
          description="Administrator-only controls for employee profiles, roles, and secure CRM access."
        />
        <EmployeesManager
          initialEmployees={employees}
          roles={roleData.roles}
          canDeactivateEmployees={canDeactivateEmployees}
        />
      </div>
    </main>
  );
}

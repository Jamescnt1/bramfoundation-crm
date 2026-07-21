import SettingsHub from "@/components/settings/SettingsHub";
import { canManageEmployees } from "@/lib/auth/roles";
import { requireEmployee } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const currentEmployee = await requireEmployee();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-sm font-medium text-gray-500">Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
            Settings
          </h1>
          <p className="mt-2 max-w-3xl text-gray-600">
            Manage company access, workflows, scheduling preferences, notifications,
            and integrations from one place.
          </p>
        </header>

        <SettingsHub
          showRestrictedSettings={canManageEmployees(currentEmployee.role)}
        />
      </div>
    </main>
  );
}

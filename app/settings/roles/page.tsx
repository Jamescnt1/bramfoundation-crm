import RolesManager from "@/components/settings/RolesManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getRolesAndPermissions } from "@/lib/services/roles-admin";
import { requireAdministrator } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function RolesSettingsPage() {
  await requireAdministrator();
  const { roles, permissions } = await getRolesAndPermissions();
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <SettingsPageHeader
          title="Roles & Permissions"
          description="Create reusable roles and control the capabilities assigned to each role."
        />
        <RolesManager initialRoles={roles} permissions={permissions} />
      </div>
    </main>
  );
}

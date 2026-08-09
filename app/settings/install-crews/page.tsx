import InstallerCrewsManager from "@/components/settings/InstallerCrewsManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getAllInstallerCrews } from "@/lib/services/configuration-admin";
import { getInstallerContacts } from "@/lib/services/installer-contacts";
import { requireAdministrator } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function InstallCrewsSettingsPage() {
  await requireAdministrator();
  const [crews, contacts] = await Promise.all([getAllInstallerCrews(), getInstallerContacts()]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SettingsPageHeader
          title="Install Crews"
          description="Manage installation crews, individual contacts, and their communication preferences."
        />
        <InstallerCrewsManager initialCrews={crews} initialContacts={contacts} />
      </div>
    </main>
  );
}

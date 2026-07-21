import LeadSourcesManager from "@/components/settings/LeadSourcesManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { requireAdministrator } from "@/lib/services/employees";
import { getAllLeadSources } from "@/lib/services/configuration-admin";

export const dynamic = "force-dynamic";

export default async function LeadSourcesSettingsPage() {
  await requireAdministrator();
  const sources = await getAllLeadSources();
  return <main className="min-h-screen bg-gray-50 p-6 md:p-8"><div className="mx-auto max-w-5xl"><SettingsPageHeader title="Lead Sources" description="Control the sources available on new leads while preserving historical reporting values." /><LeadSourcesManager initialSources={sources} /></div></main>;
}

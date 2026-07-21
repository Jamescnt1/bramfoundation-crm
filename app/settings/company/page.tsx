import CompanySettingsForm from "@/components/settings/CompanySettingsForm";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getCompanySettings } from "@/lib/services/company-settings";
import { requireAdministrator } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  await requireAdministrator();
  const settings = await getCompanySettings();
  return <main className="min-h-screen bg-gray-50 p-6 md:p-8"><div className="mx-auto max-w-5xl"><SettingsPageHeader title="Company" description="Manage company identity, contact information, and regional defaults." /><CompanySettingsForm initialSettings={settings} /></div></main>;
}

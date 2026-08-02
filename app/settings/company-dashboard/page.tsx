import CompanyDashboardRulesForm from "@/components/settings/CompanyDashboardRulesForm";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getCompanyDashboardRuleSettings } from "@/lib/services/dashboard-rule-settings";
import { requireAdministrator } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardSettingsPage() {
  await requireAdministrator();
  const settings = await getCompanyDashboardRuleSettings();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SettingsPageHeader
          title="Company Dashboard"
          description="Choose which exceptions appear in the Company Dashboard attention list."
        />
        <CompanyDashboardRulesForm initialSettings={settings} />
      </div>
    </main>
  );
}

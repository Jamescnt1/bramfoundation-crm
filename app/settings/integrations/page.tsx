import SettingsPlaceholder from "@/components/settings/SettingsPlaceholder";
import { requireEmployee } from "@/lib/services/employees";

export default async function IntegrationsSettingsPage() {
  await requireEmployee();

  return (
    <SettingsPlaceholder
      title="Integrations"
      description="Manage connections between Foundation CRM, QFloors, and future business systems."
      plannedFeatures={[
        "QFloors reference configuration",
        "Connection status and diagnostics",
        "Email and calendar connections",
        "Future integration management",
      ]}
    />
  );
}

import SettingsPlaceholder from "@/components/settings/SettingsPlaceholder";
import { requireEmployee } from "@/lib/services/employees";

export default async function BusinessHoursSettingsPage() {
  await requireEmployee();

  return (
    <SettingsPlaceholder
      title="Business Hours"
      description="Set the standard working hours used for appointment and employee scheduling."
      plannedFeatures={[
        "Company hours by weekday",
        "Scheduling boundaries",
        "Employee-specific hour overrides",
        "After-hours appointment controls",
      ]}
    />
  );
}

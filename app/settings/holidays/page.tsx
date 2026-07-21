import SettingsPlaceholder from "@/components/settings/SettingsPlaceholder";
import { requireEmployee } from "@/lib/services/employees";

export default async function HolidaysSettingsPage() {
  await requireEmployee();

  return (
    <SettingsPlaceholder
      title="Holidays"
      description="Track company closures and exceptions that affect scheduling and availability."
      plannedFeatures={[
        "Add company holidays",
        "Set full-day and partial-day closures",
        "Create recurring annual holidays",
        "Show closures on the company calendar",
      ]}
    />
  );
}

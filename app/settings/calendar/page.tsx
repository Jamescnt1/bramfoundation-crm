import SettingsPlaceholder from "@/components/settings/SettingsPlaceholder";
import { requireEmployee } from "@/lib/services/employees";

export default async function CalendarSettingsPage() {
  await requireEmployee();

  return (
    <SettingsPlaceholder
      title="Calendar"
      description="Manage calendar behavior and scheduling defaults for appointments, measures, and installations."
      plannedFeatures={[
        "Default calendar view",
        "Appointment type configuration",
        "Default appointment durations",
        "Employee and crew display preferences",
      ]}
    />
  );
}

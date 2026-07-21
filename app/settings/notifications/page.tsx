import SettingsPlaceholder from "@/components/settings/SettingsPlaceholder";
import { requireEmployee } from "@/lib/services/employees";

export default async function NotificationsSettingsPage() {
  await requireEmployee();

  return (
    <SettingsPlaceholder
      title="Notifications"
      description="Control how employees receive alerts about assignments, deadlines, and schedule changes."
      plannedFeatures={[
        "In-app notification preferences",
        "Email notification rules",
        "Task and appointment reminders",
        "Employee-specific preferences",
      ]}
    />
  );
}

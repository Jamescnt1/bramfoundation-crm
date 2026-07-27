import CalendarPreferencesForm from "@/components/settings/CalendarPreferencesForm";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { requireEmployee } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function CalendarSettingsPage() {
  const employee = await requireEmployee();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SettingsPageHeader
          title="Calendar"
          description="Choose the calendar view that works best for your schedule."
        />
        <CalendarPreferencesForm
          initialDefaultView={employee.default_calendar_view}
          initialRememberLastView={employee.remember_last_calendar_view}
        />
      </div>
    </main>
  );
}

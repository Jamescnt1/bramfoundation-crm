import AppointmentTypesManager from "@/components/settings/AppointmentTypesManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getAppointmentTypes } from "@/lib/services/appointment-types";
import { requireAdministrator } from "@/lib/services/employees";

export const dynamic = "force-dynamic";

export default async function AppointmentTypesSettingsPage() {
  await requireAdministrator();
  const appointmentTypes = await getAppointmentTypes({ includeInactive: true });

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SettingsPageHeader
          title="Appointment Types"
          description="Manage the appointment choices used by every Foundation scheduling entry point."
        />
        <AppointmentTypesManager initialTypes={appointmentTypes} />
      </div>
    </main>
  );
}

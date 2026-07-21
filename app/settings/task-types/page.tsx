import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import TaskTypesManager from "@/components/settings/TaskTypesManager";
import { requireAdministrator } from "@/lib/services/employees";
import { getAllTaskTypes } from "@/lib/services/configuration-admin";

export const dynamic = "force-dynamic";
export default async function TaskTypesSettingsPage() {
  await requireAdministrator();
  const types = await getAllTaskTypes();
  return <main className="min-h-screen bg-gray-50 p-6 md:p-8"><div className="mx-auto max-w-5xl"><SettingsPageHeader title="Task Types" description="Configure the categories used for customer work and business operations." /><TaskTypesManager initialTypes={types} /></div></main>;
}

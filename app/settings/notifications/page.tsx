import CommunicationSettingsForm from "@/components/settings/CommunicationSettingsForm";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getCommunicationSettingsPageData } from "@/lib/services/communication-settings";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const data = await getCommunicationSettingsPageData();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <SettingsPageHeader title="Communications" description="Control how the team receives email and text notifications in clear, everyday language." />
        <CommunicationSettingsForm initialData={data} />
      </div>
    </main>
  );
}

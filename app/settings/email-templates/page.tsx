import EmailTemplatesManager from "@/components/settings/EmailTemplatesManager";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { getEmailTemplates } from "@/lib/services/email-templates";

export const dynamic = "force-dynamic";
export default async function EmailTemplatesPage() {
  const templates = await getEmailTemplates();
  return <main className="min-h-screen bg-gray-50 p-6 md:p-8"><div className="mx-auto max-w-7xl"><SettingsPageHeader title="Email Templates" description="Manage customer email content used manually and by pipeline automation."/><EmailTemplatesManager initialTemplates={templates}/></div></main>;
}

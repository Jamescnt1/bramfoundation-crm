"use client";

import { useState } from "react";
import { Bell, CalendarDays, Mail, MessageSquareText, PauseCircle, Smartphone, Workflow } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  updateCommunicationSettingsAction,
  updateEmployeeCommunicationPreferenceAction,
} from "@/app/settings/notifications/actions";
import type {
  CommunicationSettingsPageData,
  EmployeeCommunicationPreference,
} from "@/lib/services/communication-settings";

type PreferenceValues = Omit<EmployeeCommunicationPreference, "employee_id" | "employee_name" | "employee_email" | "employee_phone">;

export default function CommunicationSettingsForm({ initialData }: { initialData: CommunicationSettingsPageData }) {
  const [settings, setSettings] = useState(initialData.settings);
  const [preferences, setPreferences] = useState(initialData.preferences);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveCompanySettings() {
    setSavingCompany(true); setMessage(""); setError("");
    try {
      const saved = await updateCommunicationSettingsAction({
        email_notifications_enabled: settings.email_notifications_enabled,
        sms_enabled: settings.sms_enabled,
        scheduled_communications_enabled: settings.scheduled_communications_enabled,
        automated_communications_enabled: settings.automated_communications_enabled,
        trial_mode: settings.trial_mode,
      });
      setSettings(saved);
      setMessage("Company communication controls saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save company communication controls.");
    } finally { setSavingCompany(false); }
  }

  function changePreference(employeeId: string, key: keyof PreferenceValues, checked: boolean) {
    setPreferences((current) => current.map((item) => item.employee_id === employeeId ? { ...item, [key]: checked } : item));
  }

  async function saveEmployee(preference: EmployeeCommunicationPreference) {
    setSavingEmployeeId(preference.employee_id); setMessage(""); setError("");
    try {
      await updateEmployeeCommunicationPreferenceAction(preference.employee_id, {
        email_enabled: preference.email_enabled,
        sms_enabled: preference.sms_enabled,
        appointment_notifications: preference.appointment_notifications,
        task_notifications: preference.task_notifications,
        internal_message_notifications: preference.internal_message_notifications,
        job_notifications: preference.job_notifications,
      });
      setMessage(`${preference.employee_name}'s notification preferences saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save notification preferences.");
    } finally { setSavingEmployeeId(null); }
  }

  return <div className="mt-8 space-y-6">
    {message ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-blue-950">Communication setup has started safely</h2><p className="mt-1 text-sm text-blue-800">Existing customer email continues to work. Texting, scheduled reminders, and automated communications stay paused until each phase is tested and intentionally enabled.</p></div></div>
    </section>

    {initialData.canManageCompanySettings ? <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3"><PauseCircle className="mt-0.5 h-5 w-5 text-gray-500" /><div><h2 className="text-lg font-semibold text-gray-900">Company safety controls</h2><p className="mt-1 text-sm text-gray-500">These controls pause new notification features without affecting saved history or existing customer email.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SettingToggle title="Notification emails" description="Allow new employee and installer notification emails." checked={settings.email_notifications_enabled} onChange={(checked) => setSettings({ ...settings, email_notifications_enabled: checked })} icon={<Mail />} />
        <SettingToggle title="Text messages" description="Keep off until the Twilio connection and test recipients are ready." checked={settings.sms_enabled} onChange={(checked) => setSettings({ ...settings, sms_enabled: checked })} icon={<Smartphone />} warning={!settings.sms_enabled ? "Currently paused" : undefined} />
        <SettingToggle title="Scheduled reminders" description="Allow reminders to wait and send at a chosen time." checked={settings.scheduled_communications_enabled} onChange={(checked) => setSettings({ ...settings, scheduled_communications_enabled: checked })} icon={<CalendarDays />} warning={!settings.scheduled_communications_enabled ? "Currently paused" : undefined} />
        <SettingToggle title="Automated communications" description="Allow automation rules to send messages without a manual click." checked={settings.automated_communications_enabled} onChange={(checked) => setSettings({ ...settings, automated_communications_enabled: checked })} icon={<Workflow />} warning={!settings.automated_communications_enabled ? "Currently paused" : undefined} />
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={settings.trial_mode} onChange={(event) => setSettings({ ...settings, trial_mode: event.target.checked })} className="mt-1 h-4 w-4" /><span><strong className="block text-amber-950">Twilio trial mode</strong><span className="text-sm text-amber-800">Only verified test numbers will be eligible while this is on.</span></span></label>
      <div className="mt-5 flex justify-end"><Button type="button" onClick={() => void saveCompanySettings()} disabled={savingCompany}>{savingCompany ? "Saving..." : "Save company controls"}</Button></div>
    </section> : null}

    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Employee notification preferences</h2>
      <p className="mt-1 text-sm text-gray-500">Choose how each employee wants to hear about their work. Company safety controls still take priority.</p>
      <div className="mt-5 space-y-4">{preferences.map((preference) => <article key={preference.employee_id} className="rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="font-semibold text-gray-900">{preference.employee_name}</h3><p className="mt-1 text-sm text-gray-500">{[preference.employee_email, preference.employee_phone].filter(Boolean).join(" · ") || "No email or mobile number saved"}</p></div><div className="flex flex-wrap gap-3"><CompactToggle label="Email" checked={preference.email_enabled} onChange={(checked) => changePreference(preference.employee_id, "email_enabled", checked)} /><CompactToggle label="Text" checked={preference.sms_enabled} disabled={!preference.employee_phone} onChange={(checked) => changePreference(preference.employee_id, "sms_enabled", checked)} /></div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><CompactToggle label="Appointments" checked={preference.appointment_notifications} onChange={(checked) => changePreference(preference.employee_id, "appointment_notifications", checked)} /><CompactToggle label="Tasks" checked={preference.task_notifications} onChange={(checked) => changePreference(preference.employee_id, "task_notifications", checked)} /><CompactToggle label="Internal messages" checked={preference.internal_message_notifications} onChange={(checked) => changePreference(preference.employee_id, "internal_message_notifications", checked)} /><CompactToggle label="Job updates" checked={preference.job_notifications} onChange={(checked) => changePreference(preference.employee_id, "job_notifications", checked)} /></div>
        {!preference.employee_phone ? <p className="mt-3 text-xs text-amber-700">Add a mobile number to the employee profile before enabling text notifications.</p> : null}
        <div className="mt-4 flex justify-end"><Button type="button" variant="outline" onClick={() => void saveEmployee(preference)} disabled={savingEmployeeId !== null}>{savingEmployeeId === preference.employee_id ? "Saving..." : "Save preferences"}</Button></div>
      </article>)}</div>
    </section>

    <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5"><div className="flex items-start gap-3"><MessageSquareText className="mt-0.5 h-5 w-5 text-gray-500" /><div><h2 className="font-semibold text-gray-900">Installer communication profiles</h2><p className="mt-1 text-sm text-gray-600">Individual installer contacts and their reminder choices are managed under Install Crews. Saving a contact still does not send a message.</p><Link href="/settings/install-crews" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Manage installer contacts →</Link></div></div></section>
  </div>;
}

function SettingToggle({ title, description, checked, onChange, icon, warning }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void; icon: React.ReactNode; warning?: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4"><span className="mt-0.5 text-gray-500 [&_svg]:h-5 [&_svg]:w-5">{icon}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-gray-900">{title}</strong><span className="mt-1 block text-xs text-gray-500">{description}</span>{warning ? <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{warning}</span> : null}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" /></label>;
}

function CompactToggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${disabled ? "cursor-not-allowed bg-gray-50 text-gray-400" : "cursor-pointer bg-white text-gray-700"}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />{label}</label>;
}

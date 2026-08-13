"use client";

import { useState } from "react";
import { Bell, CalendarDays, CheckCircle2, ChevronDown, Info, Mail, MessageSquareText, PauseCircle, Smartphone, Users, Workflow, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  updateCommunicationSettingsAction,
  updateEmployeeCommunicationPreferenceAction,
  sendInstallerTrialSmsAction,
} from "@/app/settings/notifications/actions";
import type {
  CommunicationSettings,
  CommunicationSettingsPageData,
  EmployeeCommunicationPreference,
} from "@/lib/services/communication-settings";

type PreferenceValues = Omit<EmployeeCommunicationPreference, "employee_id" | "employee_name" | "employee_email" | "employee_phone">;
type SettingsSection = "global" | "customers" | "employees" | "installers";

export default function CommunicationSettingsForm({ initialData }: { initialData: CommunicationSettingsPageData }) {
  const [settings, setSettings] = useState(initialData.settings);
  const [preferences, setPreferences] = useState(initialData.preferences);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testRecipientId, setTestRecipientId] = useState(initialData.smsTestRecipients[0]?.id ?? "");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("global");

  async function saveCompanySettings() {
    setSavingCompany(true); setMessage(""); setError("");
    try {
      const saved = await updateCommunicationSettingsAction({
        email_notifications_enabled: settings.email_notifications_enabled,
        sms_enabled: settings.sms_enabled,
        scheduled_communications_enabled: settings.scheduled_communications_enabled,
        automated_communications_enabled: settings.automated_communications_enabled,
        trial_mode: settings.trial_mode,
        calendar_customer_notifications_enabled: settings.calendar_customer_notifications_enabled,
        calendar_employee_notifications_enabled: settings.calendar_employee_notifications_enabled,
        calendar_installer_notifications_enabled: settings.calendar_installer_notifications_enabled,
        appointment_reminder_hours_before: settings.appointment_reminder_hours_before,
        calendar_customer_reminder_channel: settings.calendar_customer_reminder_channel,
        calendar_employee_reminder_channel: settings.calendar_employee_reminder_channel,
        calendar_installer_reminder_channel: settings.calendar_installer_reminder_channel,
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

  async function sendTestSms() {
    setSendingTest(true); setMessage(""); setError("");
    try {
      const result = await sendInstallerTrialSmsAction(testRecipientId, consentConfirmed);
      setMessage(`Test text queued for ${result.recipientName}. Twilio status: ${result.status}.`);
      setConsentConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send the Twilio test message.");
    } finally { setSendingTest(false); }
  }

  return <div className="mt-8 space-y-6">
    {message ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-blue-950">How communication controls work</h2><p className="mt-1 text-sm text-blue-800">Global settings set the company-wide limits. Audience settings and individual preferences can narrow delivery further, but cannot override a paused global setting.</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Global → Audience → Individual preference → SMS consent → Delivery</p></div></div>
    </section>

    <nav aria-label="Communication setting sections" className="grid gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:grid-cols-4">
      {([['global', 'Global'], ['customers', 'Customers'], ['employees', 'Employees'], ['installers', 'Installers']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setActiveSection(key)} className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${activeSection === key ? "bg-blue-700 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>{label}</button>)}
    </nav>

    <div className="grid gap-3 sm:grid-cols-4">
      <StatusSummary label="Email" active={settings.email_notifications_enabled} />
      <StatusSummary label="Text" active={settings.sms_enabled} />
      <StatusSummary label="Scheduled" active={settings.scheduled_communications_enabled} />
      <StatusSummary label="Automations" active={settings.automated_communications_enabled} />
    </div>

    {initialData.canManageCompanySettings && activeSection === "global" ? <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader icon={<PauseCircle />} title="Global communication settings" description="Company-wide safety controls. Turning one off pauses that capability everywhere without deleting preferences or delivery history." details="Email and Text control which delivery channels are available. Scheduled Reminders controls time-based appointment reminders. Automated Communications controls rules that send without a manual click. Both scheduled and automated controls must be on for automatic appointment reminders." />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SettingToggle title="Notification emails" description="Allow new employee and installer notification emails." checked={settings.email_notifications_enabled} onChange={(checked) => setSettings({ ...settings, email_notifications_enabled: checked })} icon={<Mail />} />
        <SettingToggle title="Text messages" description="Keep off until the Twilio connection and test recipients are ready." checked={settings.sms_enabled} onChange={(checked) => setSettings({ ...settings, sms_enabled: checked })} icon={<Smartphone />} warning={!settings.sms_enabled ? "Currently paused" : undefined} />
        <SettingToggle title="Scheduled reminders" description="Allow reminders to wait and send at a chosen time." checked={settings.scheduled_communications_enabled} onChange={(checked) => setSettings({ ...settings, scheduled_communications_enabled: checked })} icon={<CalendarDays />} warning={!settings.scheduled_communications_enabled ? "Currently paused" : undefined} />
        <SettingToggle title="Automated communications" description="Allow automation rules to send messages without a manual click." checked={settings.automated_communications_enabled} onChange={(checked) => setSettings({ ...settings, automated_communications_enabled: checked })} icon={<Workflow />} warning={!settings.automated_communications_enabled ? "Currently paused" : undefined} />
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={settings.trial_mode} onChange={(event) => setSettings({ ...settings, trial_mode: event.target.checked })} className="mt-1 h-4 w-4" /><span><strong className="block text-amber-950">Twilio trial mode</strong><span className="text-sm text-amber-800">Only verified test numbers will be eligible while this is on.</span></span></label>
      <div className="mt-5 flex justify-end"><Button type="button" onClick={() => void saveCompanySettings()} disabled={savingCompany}>{savingCompany ? "Saving..." : "Save company controls"}</Button></div>
    </section> : null}

    {initialData.canManageCompanySettings && activeSection !== "global" ? <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader icon={<Users />} title={`${activeSection === "customers" ? "Customer" : activeSection === "employees" ? "Employee" : "Installer"} communication settings`} description={activeSection === "customers" ? "Control appointment confirmations and reminders sent to project and customer contacts." : activeSection === "employees" ? "Set the company default for employees, then refine delivery for each person below." : "Control messages to assigned installer crews while respecting each installer contact’s preferences."} details={activeSection === "customers" ? "Foundation uses the project contact first, then falls back to the job or customer contact. Text messages require an opted-in mobile number." : activeSection === "employees" ? "An employee must be assigned to the appointment. Their individual Email, Text, and Appointments preferences below must also allow the delivery." : "Foundation sends to active contacts on the assigned installer crew. Each contact’s preferred channel and confirmation/reminder choices are managed under Install Crews."} />
      <div className="mt-5">
        {activeSection === "customers" ? <SettingToggle title="Customer appointment communication" description="Allow confirmations and reminders to eligible customer contacts." checked={settings.calendar_customer_notifications_enabled} onChange={(checked) => setSettings({ ...settings, calendar_customer_notifications_enabled: checked })} icon={<Users />} warning={audienceWarning(settings.calendar_customer_notifications_enabled, settings)} /> : null}
        {activeSection === "employees" ? <SettingToggle title="Employee appointment communication" description="Allow notifications to assigned employees who enabled the selected channel." checked={settings.calendar_employee_notifications_enabled} onChange={(checked) => setSettings({ ...settings, calendar_employee_notifications_enabled: checked })} icon={<Users />} warning={audienceWarning(settings.calendar_employee_notifications_enabled, settings)} /> : null}
        {activeSection === "installers" ? <SettingToggle title="Installer appointment communication" description="Allow notifications to eligible contacts on assigned installer crews." checked={settings.calendar_installer_notifications_enabled} onChange={(checked) => setSettings({ ...settings, calendar_installer_notifications_enabled: checked })} icon={<Users />} warning={audienceWarning(settings.calendar_installer_notifications_enabled, settings)} /> : null}
      </div>
      <div className="mt-5 grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-gray-700"><span>Hours before appointment</span><input type="number" min={1} max={720} step={1} list="appointment-reminder-presets" value={settings.appointment_reminder_hours_before} onChange={(event) => setSettings({ ...settings, appointment_reminder_hours_before: Number(event.target.value) })} className="h-10 rounded-lg border border-gray-300 bg-white px-3" /><span className="text-xs font-normal text-gray-500">Use 1 for one hour, 24 for one day, or any whole hour up to 30 days.</span><datalist id="appointment-reminder-presets"><option value="1" /><option value="2" /><option value="4" /><option value="12" /><option value="24" /><option value="48" /><option value="72" /><option value="168" /></datalist></label>
        {activeSection === "customers" ? <ReminderChannel label="Customer reminder channel" value={settings.calendar_customer_reminder_channel} onChange={(value) => setSettings({ ...settings, calendar_customer_reminder_channel: value })} /> : null}
        {activeSection === "employees" ? <ReminderChannel label="Employee reminder channel" value={settings.calendar_employee_reminder_channel} onChange={(value) => setSettings({ ...settings, calendar_employee_reminder_channel: value })} /> : null}
        {activeSection === "installers" ? <ReminderChannel label="Installer reminder channel" value={settings.calendar_installer_reminder_channel} onChange={(value) => setSettings({ ...settings, calendar_installer_reminder_channel: value })} /> : null}
      </div>
      <div className="mt-5 flex justify-end"><Button type="button" onClick={() => void saveCompanySettings()} disabled={savingCompany}>{savingCompany ? "Saving..." : `Save ${activeSection} settings`}</Button></div>
    </section> : null}

    {initialData.canManageCompanySettings && activeSection === "global" ? <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader icon={<Smartphone />} title="Text messaging connection" description="Provider status and a controlled test tool. Credentials stay private and are never displayed here." details="All four connection checks must be ready for Twilio delivery. This test sends one real message and records consent for the selected installer test contact. It does not enable reminders or automation rules." />
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><ConnectionItem label="Account SID" ready={initialData.twilio.accountSid} /><ConnectionItem label="Auth token" ready={initialData.twilio.authToken} /><ConnectionItem label="Messaging Service" ready={initialData.twilio.messagingServiceSid} /><ConnectionItem label="Webhook address" ready={initialData.twilio.webhookBaseUrl} /></div>
      {!initialData.twilio.configured ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Add the missing Twilio environment values in Vercel before sending a test. Credentials are never displayed in Foundation CRM.</div> : null}
      {settings.trial_mode && !initialData.twilio.testContentSid ? <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Trial mode is on. If your Twilio trial requires a pre-approved Content template, also configure <code>TWILIO_TEST_CONTENT_SID</code>.</div> : null}
      <div className="mt-5 grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-3"><label className="grid gap-2 text-sm font-medium text-gray-700"><span>Verified installer test recipient</span><select value={testRecipientId} onChange={(event) => { setTestRecipientId(event.target.value); setConsentConfirmed(false); }} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="">Choose an installer contact</option>{initialData.smsTestRecipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} — {recipient.crew_name} — {recipient.mobile_phone}{recipient.trial_recipient_verified ? " (verified)" : " (not marked verified)"}</option>)}</select></label><label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} className="mt-1" /><span>I confirm this person agreed to receive installer scheduling text messages at this number.</span></label><p className="text-xs text-gray-500">Test message: “Foundation CRM test: Installer scheduling text messages are connected. Reply STOP to unsubscribe.”</p></div>
        <Button type="button" onClick={() => void sendTestSms()} disabled={sendingTest || !initialData.twilio.configured || !testRecipientId || !consentConfirmed}>{sendingTest ? "Sending..." : "Send one test text"}</Button>
      </div>
      <div className="mt-5"><h3 className="text-sm font-semibold text-gray-900">Recent installer test texts</h3>{initialData.recentSmsTests.length ? <div className="mt-2 divide-y overflow-hidden rounded-lg border border-gray-200">{initialData.recentSmsTests.map((delivery) => <div key={delivery.id} className="flex flex-col gap-1 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><span className="font-medium text-gray-900">{delivery.recipient_name}</span><span className="ml-2 text-gray-500">{delivery.recipient_address}</span>{delivery.failure_reason ? <p className="mt-1 text-xs text-red-700">{delivery.failure_reason}</p> : null}</div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${delivery.status === "delivered" ? "bg-green-50 text-green-700" : delivery.status === "failed" || delivery.status === "undelivered" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{delivery.status}</span><time className="text-xs text-gray-500">{new Date(delivery.created_at).toLocaleString()}</time></div></div>)}</div> : <p className="mt-2 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">No installer test texts have been sent.</p>}</div>
    </section> : null}

    {activeSection === "employees" ? <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader icon={<Users />} title="Individual employee preferences" description="Choose how each employee wants to hear about their work. Employee cards are collapsed to keep this page easy to scan." details="Company and Employee audience controls always take priority. Turning off Appointments blocks both appointment email and text for that employee. Other categories are stored for their respective notification workflows." />
      <div className="mt-5 space-y-3">{preferences.map((preference) => <details key={preference.employee_id} className="group rounded-xl border border-gray-200 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4"><div><h3 className="font-semibold text-gray-900">{preference.employee_name}</h3><p className="mt-1 text-sm text-gray-500">{employeeSummary(preference)}</p></div><ChevronDown className="h-5 w-5 text-gray-400 transition group-open:rotate-180" /></summary>
        <article className="mt-5 border-t border-gray-100 pt-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="font-semibold text-gray-900">{preference.employee_name}</h3><p className="mt-1 text-sm text-gray-500">{[preference.employee_email, preference.employee_phone].filter(Boolean).join(" · ") || "No email or mobile number saved"}</p></div><div className="flex flex-wrap gap-3"><CompactToggle label="Email" checked={preference.email_enabled} onChange={(checked) => changePreference(preference.employee_id, "email_enabled", checked)} /><CompactToggle label="Text" checked={preference.sms_enabled} disabled={!preference.employee_phone} onChange={(checked) => changePreference(preference.employee_id, "sms_enabled", checked)} /></div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><CompactToggle label="Appointments" checked={preference.appointment_notifications} onChange={(checked) => changePreference(preference.employee_id, "appointment_notifications", checked)} /><CompactToggle label="Tasks" checked={preference.task_notifications} onChange={(checked) => changePreference(preference.employee_id, "task_notifications", checked)} /><CompactToggle label="Internal messages" checked={preference.internal_message_notifications} onChange={(checked) => changePreference(preference.employee_id, "internal_message_notifications", checked)} /><CompactToggle label="Job updates" checked={preference.job_notifications} onChange={(checked) => changePreference(preference.employee_id, "job_notifications", checked)} /></div>
        {!preference.employee_phone ? <p className="mt-3 text-xs text-amber-700">Add a mobile number to the employee profile before enabling text notifications.</p> : null}
        <div className="mt-4 flex justify-end"><Button type="button" variant="outline" onClick={() => void saveEmployee(preference)} disabled={savingEmployeeId !== null}>{savingEmployeeId === preference.employee_id ? "Saving..." : "Save preferences"}</Button></div>
      </article></details>)}</div>
    </section> : null}

    {activeSection === "customers" ? <InfoPanel title="Customer eligibility" body="Email requires a saved email address. Text messages require a mobile number and recorded opt-in. A customer who replied STOP remains blocked until they opt in again." links={[{ href: "/sms-opt-in", label: "View SMS opt-in page" }, { href: "/privacy", label: "View privacy policy" }]} /> : null}

    {activeSection === "installers" ? <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5"><div className="flex items-start gap-3"><MessageSquareText className="mt-0.5 h-5 w-5 text-gray-500" /><div><h2 className="font-semibold text-gray-900">Individual installer profiles</h2><p className="mt-1 text-sm text-gray-600">Installer contacts, preferred channels, confirmation choices, reminder choices, and schedule-change preferences are managed with their crews.</p><Link href="/settings/install-crews" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Manage installer contacts →</Link></div></div></section> : null}
  </div>;
}

function SettingToggle({ title, description, checked, onChange, icon, warning }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void; icon: React.ReactNode; warning?: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4"><span className="mt-0.5 text-gray-500 [&_svg]:h-5 [&_svg]:w-5">{icon}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-gray-900">{title}</strong><span className="mt-1 block text-xs text-gray-500">{description}</span>{warning ? <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{warning}</span> : null}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" /></label>;
}

function CompactToggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${disabled ? "cursor-not-allowed bg-gray-50 text-gray-400" : "cursor-pointer bg-white text-gray-700"}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />{label}</label>;
}

function ReminderChannel({ label, value, onChange }: { label: string; value: "email" | "sms"; onChange: (value: "email" | "sms") => void }) {
  return <label className="grid gap-2 text-sm font-medium text-gray-700"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as "email" | "sms")} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="email">Email</option><option value="sms">Text message</option></select></label>;
}

function ConnectionItem({ label, ready }: { label: string; ready: boolean }) { return <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${ready ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 bg-gray-50 text-gray-600"}`}>{ready ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}<span>{label}</span></div>; }

function SectionHeader({ icon, title, description, details }: { icon: React.ReactNode; title: string; description: string; details: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 text-gray-500 [&_svg]:h-5 [&_svg]:w-5">{icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-gray-900">{title}</h2><details className="group relative"><summary aria-label={`More information about ${title}`} className="flex cursor-pointer list-none items-center rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-700"><Info className="h-4 w-4" /></summary><div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900 sm:max-w-2xl">{details}</div></details></div><p className="mt-1 text-sm text-gray-500">{description}</p></div></div>;
}

function StatusSummary({ label, active }: { label: string; active: boolean }) {
  return <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${active ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 bg-gray-50 text-gray-500"}`}><span className="font-medium">{label}</span><span className="text-xs font-semibold uppercase tracking-wide">{active ? "On" : "Paused"}</span></div>;
}

function audienceWarning(enabled: boolean, settings: CommunicationSettings) {
  if (!enabled) return "This audience is paused";
  if (!settings.email_notifications_enabled && !settings.sms_enabled) return "Blocked: Email and Text are paused globally";
  if (!settings.scheduled_communications_enabled && !settings.automated_communications_enabled) return "Manual sends only";
  return undefined;
}

function employeeSummary(preference: EmployeeCommunicationPreference) {
  const channels = [preference.email_enabled && "Email", preference.sms_enabled && "Text"].filter(Boolean).join(" + ") || "No channels";
  const appointments = preference.appointment_notifications ? "appointments on" : "appointments off";
  return `${channels} · ${appointments}`;
}

function InfoPanel({ title, body, links }: { title: string; body: string; links?: { href: string; label: string }[] }) {
  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-5"><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-blue-950">{title}</h2><p className="mt-1 text-sm leading-6 text-blue-800">{body}</p>{links?.length ? <div className="mt-2 flex flex-wrap gap-4">{links.map((link) => <Link key={link.href} href={link.href} className="text-sm font-semibold text-blue-700 hover:underline">{link.label} →</Link>)}</div> : null}</div></div></section>;
}

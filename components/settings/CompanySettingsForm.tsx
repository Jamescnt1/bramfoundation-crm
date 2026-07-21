"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCompanySettingsAction } from "@/app/settings/company/actions";
import type {
  CompanySettings,
  CompanySettingsValues,
} from "@/lib/services/company-settings";

const timezones = [
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
];

export default function CompanySettingsForm({
  initialSettings,
}: {
  initialSettings: CompanySettings;
}) {
  const [values, setValues] = useState<CompanySettingsValues>({
    company_name: initialSettings.company_name,
    phone: initialSettings.phone,
    email: initialSettings.email,
    website: initialSettings.website,
    address: initialSettings.address,
    timezone: initialSettings.timezone,
    locale: initialSettings.locale,
    currency: initialSettings.currency,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function set(field: keyof CompanySettingsValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await updateCompanySettingsAction(initialSettings.id, values);
      setMessage("Company settings saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save company settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      {message ? <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Company identity</h2>
        <p className="mt-1 text-sm text-gray-500">Contact and branding details used throughout Foundation CRM.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Company Name" required><Input value={values.company_name} onChange={(event) => set("company_name", event.target.value)} required /></Field>
          <Field label="Phone"><Input type="tel" value={values.phone ?? ""} onChange={(event) => set("phone", event.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={values.email ?? ""} onChange={(event) => set("email", event.target.value)} /></Field>
          <Field label="Website"><Input type="url" value={values.website ?? ""} onChange={(event) => set("website", event.target.value)} placeholder="https://bramflooring.com" /></Field>
          <div className="sm:col-span-2"><Field label="Address"><textarea value={values.address ?? ""} onChange={(event) => set("address", event.target.value)} rows={3} className={inputClass} /></Field></div>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
          <div className="flex items-center gap-3"><span className="rounded-lg bg-white p-2 text-gray-500 shadow-sm"><ImagePlus className="h-5 w-5" /></span><div><p className="font-medium text-gray-900">Company logo</p><p className="text-sm text-gray-500">Logo upload will be enabled when shared file storage is configured.</p></div></div>
          <Button type="button" variant="outline" disabled className="mt-4">Upload logo (coming soon)</Button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Regional defaults</h2>
        <p className="mt-1 text-sm text-gray-500">Defaults used for dates, scheduling, and future reporting.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <Field label="Default Time Zone"><select value={values.timezone} onChange={(event) => set("timezone", event.target.value)} className={inputClass}>{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select></Field>
          <Field label="Locale"><select value={values.locale} onChange={(event) => set("locale", event.target.value)} className={inputClass}><option value="en-US">English (United States)</option></select></Field>
          <Field label="Currency"><select value={values.currency} onChange={(event) => set("currency", event.target.value)} className={inputClass}><option value="USD">USD — US Dollar</option></select></Field>
        </div>
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600"><span className="font-medium text-gray-900">Business hours:</span> the data model is ready; scheduling controls will be completed in the dedicated Business Hours section.</div>
      </section>

      <div className="flex justify-end"><Button disabled={saving}>{saving ? "Saving..." : "Save Company Settings"}</Button></div>
    </form>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-gray-700">{label}{required ? <span className="sr-only"> required</span> : null}{children}</label>;
}

const inputClass = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200";

"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
const maxLogoBytes = 5 * 1024 * 1024;
const allowedLogoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export default function CompanySettingsForm({
  initialSettings,
}: {
  initialSettings: CompanySettings;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState(initialSettings);
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
  const [uploading, setUploading] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
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
      const saved = await updateCompanySettingsAction(settings.id, values);
      setSettings(saved);
      setValues({
        company_name: saved.company_name,
        phone: saved.phone,
        email: saved.email,
        website: saved.website,
        address: saved.address,
        timezone: saved.timezone,
        locale: saved.locale,
        currency: saved.currency,
      });
      setMessage("Company settings saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save company settings.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (file.size <= 0) {
      setError("The selected logo file is empty (0 bytes). Export or download the image, then choose it again.");
      return;
    }
    if (file.size > maxLogoBytes) {
      setError(`The selected logo is ${formatFileSize(file.size)}. The maximum size is 5 MB.`);
      return;
    }
    if (!allowedLogoTypes.has(file.type)) {
      setError(`The selected file type (${file.type || "unknown"}) is not supported. Choose a JPG, PNG, WebP, or SVG image.`);
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");
    try {
      const body = new FormData();
      body.append("id", settings.id);
      body.append("file", file);
      const response = await fetch("/api/company/logo", { method: "POST", body });
      const result = (await response.json()) as { settings?: CompanySettings; error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error ?? "Unable to upload the company logo.");
      setSettings(result.settings);
      setSelectedLogo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Company logo uploaded.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload the company logo.");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setUploading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/company/logo?id=${encodeURIComponent(settings.id)}`, { method: "DELETE" });
      const result = (await response.json()) as { settings?: CompanySettings; error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error ?? "Unable to remove the company logo.");
      setSettings(result.settings);
      setMessage("Company logo removed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove the company logo.");
    } finally {
      setUploading(false);
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-2">
              {settings.logo_url ? <Image src={settings.logo_url} alt={`${values.company_name} logo`} width={240} height={120} unoptimized className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-7 w-7 text-gray-400" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Company logo</p>
              <p className="text-sm text-gray-500">JPG, PNG, WebP, or SVG. Maximum 5 MB.</p>
              {selectedLogo ? <p className="mt-1 text-sm font-medium text-gray-700">Selected: {selectedLogo.name} ({formatFileSize(selectedLogo.size)})</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; setSelectedLogo(file); setMessage(""); setError(""); }} />
              <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{selectedLogo ? "Choose another" : settings.logo_url ? "Replace logo" : "Choose logo"}</Button>
              {selectedLogo ? <Button type="button" disabled={uploading} onClick={() => void uploadLogo(selectedLogo)}>{uploading ? "Uploading..." : "Upload selected logo"}</Button> : null}
              {settings.logo_url ? <Button type="button" variant="outline" disabled={uploading} onClick={() => void removeLogo()}><Trash2 className="mr-2 h-4 w-4" />Remove</Button> : null}
            </div>
          </div>
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

      <div className="flex justify-end"><Button type="submit" disabled={saving || uploading}>{saving ? "Saving..." : "Save Company Settings"}</Button></div>
    </form>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-gray-700">{label}{required ? <span className="sr-only"> required</span> : null}{children}</label>;
}

const inputClass = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

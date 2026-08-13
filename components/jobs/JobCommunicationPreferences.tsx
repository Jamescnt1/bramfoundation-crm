"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { updateJobCommunicationPreferencesAction } from "@/app/actions/job-communications";
import type { Job } from "@/lib/services/jobs";
import { Button } from "@/components/ui/button";

export default function JobCommunicationPreferences({ job }: { job: Job }) {
  const [mode, setMode] = useState(job.customer_communication_mode);
  const [channel, setChannel] = useState(job.preferred_communication_channel);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const customerEnabled = job.customer?.automated_communications_enabled ?? false;

  async function save() {
    setSaving(true); setNotice(""); setError("");
    try {
      await updateJobCommunicationPreferencesAction({ jobId: job.id, mode, channel });
      setNotice("Job communication preferences saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save job communication preferences.");
    } finally { setSaving(false); }
  }

  const effective = mode === "on" || (mode === "inherit" && customerEnabled);
  return <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2"><BellRing className="mt-0.5 h-4 w-4 text-[#3f6e8c]"/><div><h3 className="text-sm font-semibold text-gray-950">Automatic customer communications</h3><p className="mt-0.5 text-xs text-gray-500">This job is currently <strong>{effective ? "eligible" : "off"}</strong>. Appointments must also be enabled individually.</p></div></div>
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${effective ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{effective ? "Eligible" : "Off"}</span>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <label className="grid gap-1 text-xs font-medium text-gray-600">Job setting<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"><option value="off">Off</option><option value="inherit">Use customer setting ({customerEnabled ? "On" : "Off"})</option><option value="on">On for this job</option></select></label>
      <label className="grid gap-1 text-xs font-medium text-gray-600">Preferred method<select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"><option value="inherit">Use customer preference</option><option value="email">Email</option><option value="sms">Text message</option><option value="both">Text and email</option></select></label>
      <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
    </div>
    {notice ? <p className="mt-2 text-xs text-green-700">{notice}</p> : null}{error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
  </section>;
}

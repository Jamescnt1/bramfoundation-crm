"use client";

import { useState, type ReactNode } from "react";
import { BellOff, ClipboardCheck } from "lucide-react";
import { updateCustomerFollowUpPreferencesAction } from "@/app/customers/[id]/follow-up-actions";

type Props = {
  customerId: string;
  initialLeadFollowupsEnabled: boolean;
  initialEstimateFollowupsEnabled: boolean;
  canManage: boolean;
};

export default function CustomerFollowUpPreferences({
  customerId,
  initialLeadFollowupsEnabled,
  initialEstimateFollowupsEnabled,
  canManage,
}: Props) {
  const [leadEnabled, setLeadEnabled] = useState(initialLeadFollowupsEnabled);
  const [estimateEnabled, setEstimateEnabled] = useState(initialEstimateFollowupsEnabled);
  const [saving, setSaving] = useState<"lead" | "estimate" | null>(null);
  const [message, setMessage] = useState("");

  async function save(kind: "lead" | "estimate", checked: boolean) {
    const previousLead = leadEnabled;
    const previousEstimate = estimateEnabled;
    const nextLead = kind === "lead" ? checked : leadEnabled;
    const nextEstimate = kind === "estimate" ? checked : estimateEnabled;
    setLeadEnabled(nextLead);
    setEstimateEnabled(nextEstimate);
    setSaving(kind);
    setMessage("");
    try {
      const saved = await updateCustomerFollowUpPreferencesAction(customerId, {
        leadFollowupsEnabled: nextLead,
        estimateFollowupsEnabled: nextEstimate,
      });
      setLeadEnabled(saved.leadFollowupsEnabled);
      setEstimateEnabled(saved.estimateFollowupsEnabled);
      setMessage("Follow-up preferences saved.");
    } catch (error) {
      setLeadEnabled(previousLead);
      setEstimateEnabled(previousEstimate);
      setMessage(error instanceof Error ? error.message : "Unable to save follow-up preferences.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex items-start gap-3">
        <BellOff className="mt-0.5 h-5 w-5 text-gray-500" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Automatic follow-up reminders</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">Control routine sales follow-up tasks for every job under this customer. Manual tasks and appointment reminders are not affected.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Preference
          icon={<ClipboardCheck className="h-4 w-4" />}
          title="Lead follow-ups"
          description="New Lead and untouched-lead reminders."
          checked={leadEnabled}
          disabled={!canManage || saving !== null}
          saving={saving === "lead"}
          onChange={(checked) => void save("lead", checked)}
        />
        <Preference
          icon={<ClipboardCheck className="h-4 w-4" />}
          title="Estimate follow-ups"
          description="Follow-up tasks created when an estimate is sent."
          checked={estimateEnabled}
          disabled={!canManage || saving !== null}
          saving={saving === "estimate"}
          onChange={(checked) => void save("estimate", checked)}
        />
      </div>
      {!canManage ? <p className="mt-2 text-xs text-gray-500">You do not have permission to change customer follow-up settings.</p> : null}
      {message ? <p className={`mt-2 text-xs font-medium ${message.includes("saved") ? "text-emerald-700" : "text-red-700"}`}>{message}</p> : null}
    </section>
  );
}

function Preference({ icon, title, description, checked, disabled, saving, onChange }: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  saving: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-lg border p-3 ${checked ? "border-blue-200 bg-blue-50/60" : "border-gray-200 bg-gray-50"}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">{icon}{title}<span className={`rounded-full px-2 py-0.5 text-[10px] ${checked ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>{saving ? "Saving…" : checked ? "On" : "Off"}</span></span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">{description}{!checked ? " Existing open automated reminders are cancelled." : ""}</span>
      </span>
    </label>
  );
}

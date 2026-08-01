"use client";

import { useState } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { setProductionWorkflowEnabledAction } from "@/app/settings/pipeline/actions";

export default function ProductionWorkflowSettings({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    const next = !enabled;
    const message = next
      ? "Enable the unified In Progress production workflow? Existing legacy production jobs will be grouped into In Progress."
      : "Revert to the legacy Materials Ordered and Install Scheduled pipeline stages? Production records will be preserved.";
    if (!window.confirm(message)) return;
    setBusy(true); setError("");
    try { await setProductionWorkflowEnabledAction(next); window.location.reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change the production workflow."); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3"><span className={`mt-0.5 rounded-lg p-2 ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{enabled ? <ShieldCheck className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}</span><div><h2 className="font-semibold text-gray-900">Unified production workflow</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">{enabled ? "In Progress is active and protected. Materials, scheduling, and work orders are managed inside Production." : "Legacy production pipeline stages are active. Production records remain preserved."}</p></div></div>
      <button type="button" onClick={() => void toggle()} disabled={busy} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${enabled ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50" : "bg-[#3f6e8c] text-white hover:bg-[#315b76]"}`}>{busy ? "Updating…" : enabled ? "Revert to legacy stages" : "Enable In Progress"}</button>
    </div>
    {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">Reverting changes the pipeline presentation and job stage mapping only. Material scopes, appointments, work orders, tasks, and audit history are never deleted.</p>
  </section>;
}

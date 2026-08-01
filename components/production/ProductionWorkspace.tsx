"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Package, Plus } from "lucide-react";
import { addMaterialScopeAction, updateMaterialScopeStatusAction } from "@/app/leads/[id]/production/actions";
import type { MaterialCategory, MaterialScope, ProductionSummary } from "@/components/production/types";
import ProductionProgress from "@/components/production/ProductionProgress";
import JobInstallationsPanel from "@/components/jobs/JobInstallationsPanel";
import type { CalendarAppointment } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ProductionWorkspace({
  jobId, scopes, categories, summary, appointments, installationRequired, onSchedule,
}: {
  jobId: string;
  scopes: MaterialScope[];
  categories: MaterialCategory[];
  summary: ProductionSummary;
  appointments: CalendarAppointment[];
  installationRequired: boolean;
  onSchedule: () => void;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function addScope() {
    if (!categoryId) return setError("Choose a material category.");
    setBusyId("new"); setError("");
    try {
      await addMaterialScopeAction({ jobId, categoryId, description });
      setAddOpen(false); setDescription(""); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add material."); }
    finally { setBusyId(null); }
  }

  async function setStatus(scope: MaterialScope, status: "ordered" | "ready" | "issue" | "excluded") {
    let etaDate: string | null = scope.eta_date;
    let note: string | null = null;
    if (status === "ordered") {
      etaDate = window.prompt("Material ETA (YYYY-MM-DD)", scope.eta_date ?? "")?.trim() || null;
      if (!etaDate) return;
    }
    if (status === "issue") note = window.prompt("What needs attention?", scope.issue_note ?? "")?.trim() || null;
    if (status === "excluded") note = window.prompt("Why is this material excluded from production tracking?", scope.excluded_reason ?? "")?.trim() || null;
    setBusyId(scope.id); setError("");
    try { await updateMaterialScopeStatusAction({ jobId, scopeId: scope.id, status, etaDate, note }); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update material."); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-3">
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-semibold text-gray-950">Production Readiness</h3><p className="mt-1 text-sm text-gray-500">Materials, installations, and crew work orders stay synchronized.</p></div>
        <Button type="button" onClick={() => setAddOpen(true)}><Plus /> Add Material</Button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SummaryTile icon={<Package />} label="Materials" value={`${summary.materials_ready}/${summary.materials_total} ready`} />
        <SummaryTile icon={<CheckCircle2 />} label="Installations" value={`${summary.installations_scheduled}/${summary.installations_required} scheduled`} />
        <SummaryTile icon={<CheckCircle2 />} label="Work Orders" value={`${summary.work_orders_sent}/${summary.work_orders_required} sent`} />
      </div>
    </section>

    {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <ProductionProgress scopes={scopes} summary={summary} onOpen={() => undefined} />
      {scopes.length ? <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
        {scopes.map((scope) => <div key={scope.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><p className="font-semibold text-gray-900">{scope.category.name}{scope.description ? ` — ${scope.description}` : ""}</p><p className="mt-1 text-xs text-gray-500">{scope.eta_date ? `Expected ${formatDate(scope.eta_date)}` : "ETA not entered"}{scope.issue_note ? ` · ${scope.issue_note}` : ""}</p></div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => void setStatus(scope, "ordered")}>Mark ordered</Button>
            <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => void setStatus(scope, "ready")}>Mark ready</Button>
            <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => void setStatus(scope, "issue")}><AlertTriangle /> Issue</Button>
            <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => void setStatus(scope, "excluded")}>Exclude</Button>
          </div>
        </div>)}
      </div> : null}
    </section>

    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <JobInstallationsPanel jobId={jobId} appointments={appointments} installationRequired={installationRequired} onSchedule={onSchedule} />
    </section>

    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add material scope</DialogTitle><DialogDescription>Add the operational material group once. Its milestones will update throughout Foundation.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-2 text-sm font-medium">Material category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Scope or area<Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Locker rooms, upstairs, restrooms…" /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="button" disabled={busyId !== null} onClick={() => void addScope()}>{busyId === "new" ? "Adding…" : "Add material"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"><span className="text-[#3f6e8c] [&_svg]:h-5 [&_svg]:w-5">{icon}</span><div><p className="text-xs text-gray-500">{label}</p><p className="font-semibold text-gray-950">{value}</p></div></div>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Package, Plus, Send } from "lucide-react";
import { addMaterialScopeAction, linkMaterialScopeAppointmentAction, updateMaterialScopeStatusAction } from "@/app/leads/[id]/production/actions";
import type { MaterialCategory, MaterialScope, MaterialStatus, ProductionSummary } from "@/components/production/types";
import ProductionProgress from "@/components/production/ProductionProgress";
import JobInstallationsPanel from "@/components/jobs/JobInstallationsPanel";
import type { CalendarAppointment } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type StatusDialog = { scope: MaterialScope; status: MaterialStatus } | null;

export default function ProductionWorkspace({
  jobId, scopes, categories, summary, appointments, installationRequired, onSchedule,
}: {
  jobId: string;
  scopes: MaterialScope[];
  categories: MaterialCategory[];
  summary: ProductionSummary;
  appointments: CalendarAppointment[];
  installationRequired: boolean;
  onSchedule: (scopeId?: string) => void;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [statusDialog, setStatusDialog] = useState<StatusDialog>(null);
  const [etaDate, setEtaDate] = useState("");
  const [note, setNote] = useState("");
  const [installSelections, setInstallSelections] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function addScope() {
    if (!categoryId) return setError("Choose a material category.");
    setBusyId("new"); setError("");
    try {
      await addMaterialScopeAction({ jobId, categoryId, description });
      setAddOpen(false); setDescription(""); router.refresh();
    } catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  function openStatus(scope: MaterialScope, status: MaterialStatus) {
    if (status === "ready") return void saveStatus(scope, status, scope.eta_date, null);
    setStatusDialog({ scope, status });
    setEtaDate(scope.eta_date ?? "");
    setNote(status === "issue" ? scope.issue_note ?? "" : status === "excluded" ? scope.excluded_reason ?? "" : "");
    setError("");
  }

  async function saveStatus(scope: MaterialScope, status: MaterialStatus, eta: string | null, detail: string | null) {
    setBusyId(scope.id); setError("");
    try {
      await updateMaterialScopeStatusAction({ jobId, scopeId: scope.id, status, etaDate: eta, note: detail });
      setStatusDialog(null); router.refresh();
    } catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  async function linkExistingInstall(scope: MaterialScope) {
    const appointmentId = installSelections[scope.id] || activeInstallations[0]?.id;
    if (!appointmentId) return;
    setBusyId(scope.id); setError("");
    try { await linkMaterialScopeAppointmentAction({ jobId, scopeId: scope.id, appointmentId }); router.refresh(); }
    catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  const activeInstallations = appointments.filter((item) => item.appointment_type === "installation" && item.status !== "cancelled");

  return <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <header className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="font-semibold text-gray-950">Production Readiness</h3><p className="mt-1 text-sm text-gray-500">One connected workflow for materials, installation scopes, and crew work orders.</p></div>
      <div className="flex items-center gap-2"><span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">{summary.completed_steps}/{summary.total_steps} complete</span><Button type="button" onClick={() => setAddOpen(true)}><Plus /> Add Material</Button></div>
    </header>

    <div className="grid gap-px bg-gray-200 sm:grid-cols-3">
      <SummaryTile icon={<Package />} label="Materials" value={`${summary.materials_ready}/${summary.materials_total} ready`} attention={summary.materials_ready < summary.materials_total} />
      <SummaryTile icon={<CalendarDays />} label="Installations" value={`${summary.installations_scheduled}/${summary.installations_required} scheduled`} attention={summary.installations_scheduled < summary.installations_required} />
      <SummaryTile icon={<Send />} label="Work Orders" value={`${summary.work_orders_sent}/${summary.work_orders_required} sent`} attention={summary.work_orders_sent < summary.work_orders_required} />
    </div>

    {error ? <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

    <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.8fr)]">
      <div className="min-w-0 p-4 xl:border-r xl:border-gray-200">
        <div className="flex items-center justify-between"><div><h4 className="font-semibold text-gray-950">Material Scopes</h4><p className="mt-1 text-xs text-gray-500">Each step fills automatically from the action that completes it.</p></div></div>
        <div className="mt-3 rounded-lg border border-gray-200 p-3">
          <ProductionProgress scopes={scopes} summary={summary} hideHeader hideFooter onOpen={() => undefined} />
        </div>
        {scopes.length ? <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 px-3">
          {scopes.map((scope) => {
            const scheduled = scope.appointments.some((item) => item.status !== "cancelled");
            return <article key={scope.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-gray-900">{scope.category.name}{scope.description ? ` — ${scope.description}` : ""}</p><StatusBadge scope={scope} /></div><p className="mt-1 text-xs text-gray-500">{scope.eta_date ? `Expected ${formatDate(scope.eta_date)}` : scope.ordering_required ? "ETA not entered" : "Ordering not required"}{scope.issue_note ? ` · ${scope.issue_note}` : ""}</p></div>
              <div className="flex flex-wrap gap-1.5">
                {!['ordered','partially_received','ready','excluded'].includes(scope.material_status) ? <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => openStatus(scope, "ordered")}>Mark ordered</Button> : null}
                {scope.material_status !== "ready" && scope.material_status !== "excluded" ? <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => openStatus(scope, "ready")}>Mark ready</Button> : null}
                {scope.installation_required && !scheduled && activeInstallations.length ? <><select value={installSelections[scope.id] || activeInstallations[0]?.id} onChange={(event) => setInstallSelections((current) => ({ ...current, [scope.id]: event.target.value }))} className="h-8 max-w-44 rounded-md border border-gray-300 bg-white px-2 text-xs">{activeInstallations.map((item) => <option key={item.id} value={item.id}>{formatDateTime(item.starts_at)} · {item.installer_crew?.name ?? "Unassigned crew"}</option>)}</select><Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => void linkExistingInstall(scope)}>Link install</Button></> : null}
                {scope.installation_required && !scheduled ? <Button type="button" size="sm" variant="outline" onClick={() => onSchedule(scope.id)}><CalendarDays /> Schedule new</Button> : null}
                <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => openStatus(scope, "issue")}><AlertTriangle /> Issue</Button>
                <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => openStatus(scope, "excluded")}>Exclude</Button>
              </div>
            </article>;
          })}
        </div> : null}
      </div>

      <aside className="min-w-0 bg-gray-50/60 p-4">
        <div className="mb-3"><h4 className="font-semibold text-gray-950">Crew Assignments</h4><p className="mt-1 text-xs text-gray-500">{activeInstallations.length} scheduled installation{activeInstallations.length === 1 ? "" : "s"}; work orders update the same material pipeline.</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><JobInstallationsPanel jobId={jobId} appointments={appointments} installationRequired={installationRequired} compact={false} onSchedule={() => onSchedule()} /></div>
      </aside>
    </div>

    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add material scope</DialogTitle><DialogDescription>Add the operational material group once. Its milestones will update throughout Foundation.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-2 text-sm font-medium">Material category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Scope or area<Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Locker rooms, upstairs, restrooms…" /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="button" disabled={busyId !== null} onClick={() => void addScope()}>{busyId === "new" ? "Adding…" : "Add material"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(statusDialog)} onOpenChange={(open) => !open && setStatusDialog(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{statusDialog?.status === "ordered" ? "Material ordered" : statusDialog?.status === "issue" ? "Report material issue" : "Exclude material step"}</DialogTitle><DialogDescription>{statusDialog?.scope.category.name}{statusDialog?.scope.description ? ` — ${statusDialog.scope.description}` : ""}</DialogDescription></DialogHeader><div className="grid gap-4 py-5">{statusDialog?.status === "ordered" ? <label className="grid gap-2 text-sm font-medium">Expected arrival date<Input type="date" value={etaDate} onChange={(event) => setEtaDate(event.target.value)} required /><span className="text-xs font-normal text-gray-500">Foundation uses this date to warn when material may arrive after the planned installation.</span></label> : <label className="grid gap-2 text-sm font-medium">{statusDialog?.status === "issue" ? "What needs attention?" : "Reason for exclusion"}<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="rounded-lg border border-gray-300 p-3 text-sm" autoFocus /></label>}{error ? <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button><Button type="button" disabled={!statusDialog || busyId !== null || (statusDialog.status === "ordered" && !etaDate)} onClick={() => statusDialog && void saveStatus(statusDialog.scope, statusDialog.status, etaDate || null, note || null)}>{busyId ? "Saving…" : "Save"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

function SummaryTile({ icon, label, value, attention }: { icon: React.ReactNode; label: string; value: string; attention: boolean }) {
  return <div className="flex items-center gap-3 bg-white p-4"><span className={`rounded-lg p-2 [&_svg]:h-5 [&_svg]:w-5 ${attention ? "bg-amber-50 text-[#c89c45]" : "bg-emerald-50 text-[#5d8a52]"}`}>{icon}</span><div><p className="text-xs text-gray-500">{label}</p><p className="font-semibold text-gray-950">{value}</p></div></div>;
}
function StatusBadge({ scope }: { scope: MaterialScope }) {
  const style = scope.material_status === "ready" ? "bg-emerald-50 text-emerald-700" : scope.material_status === "issue" ? "bg-red-50 text-red-700" : scope.material_status === "excluded" ? "bg-gray-100 text-gray-600" : scope.material_status === "ordered" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style}`}>{scope.material_status.split("_").join(" ")}</span>;
}
function message(error: unknown) { return error instanceof Error ? error.message : "Unable to update production."; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }

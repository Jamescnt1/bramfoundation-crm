"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Check, Circle, ClipboardList, MapPinned, MoreHorizontal, Package, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { addMaterialScopeAction, deleteProductionScopeAction, recordCompletionCheckAction, resetCompletionCheckAction, unlinkMaterialScopeAppointmentAction, updateMaterialScopeStatusAction, updateProductionScopeAction } from "@/app/leads/[id]/production/actions";
import type { CompletionCheckMethod, MaterialCategory, MaterialScope, MaterialStatus, ProductionSummary } from "@/components/production/types";
import type { CalendarAppointment } from "@/components/calendar/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { setInstallationWorkOrderSentAction } from "@/app/leads/[id]/installations/actions";
import { productionPipelineErrorMessage } from "@/lib/production-pipeline-error";

type StatusDialog = { scope: MaterialScope; status: MaterialStatus } | null;

export default function ProductionWorkspace({
  jobId, scopes, categories, summary, appointments, installationRequired, onSchedule, onEditInstallation,
}: {
  jobId: string;
  scopes: MaterialScope[];
  categories: MaterialCategory[];
  summary: ProductionSummary;
  appointments: CalendarAppointment[];
  installationRequired: boolean;
  onSchedule: (scopeId?: string, type?: "installation" | "job_walk") => void;
  onEditInstallation: (appointment: CalendarAppointment) => void;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<MaterialScope | null>(null);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [completionCheckMethod, setCompletionCheckMethod] = useState<CompletionCheckMethod>("customer_checkin");
  const [completionCheckNotes, setCompletionCheckNotes] = useState("");
  const [completionScope, setCompletionScope] = useState<MaterialScope | null>(null);
  const [completionContact, setCompletionContact] = useState("");
  const [completionContactMethod, setCompletionContactMethod] = useState<"phone" | "email" | "text" | "in_person" | "other">("phone");
  const [completionOutcome, setCompletionOutcome] = useState<"satisfied" | "issue">("satisfied");
  const [statusDialog, setStatusDialog] = useState<StatusDialog>(null);
  const [etaDate, setEtaDate] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function beginAdd() {
    setEditingScope(null); setCategoryId(categories[0]?.id ?? ""); setDescription(""); setCompletionCheckMethod("customer_checkin"); setCompletionCheckNotes(""); setError(""); setAddOpen(true);
  }

  function beginEdit(scope: MaterialScope) {
    setEditingScope(scope); setCategoryId(scope.material_category_id); setDescription(scope.description ?? ""); setCompletionCheckMethod(scope.completion_check_method); setCompletionCheckNotes(scope.completion_check_notes ?? ""); setError(""); setAddOpen(true);
  }

  async function saveScope() {
    if (!categoryId) return setError("Choose a material category.");
    setBusyId(editingScope?.id ?? "new"); setError("");
    try {
      if (editingScope) await updateProductionScopeAction({ jobId, scopeId: editingScope.id, categoryId, description, completionCheckMethod, completionCheckNotes });
      else await addMaterialScopeAction({ jobId, categoryId, description, completionCheckMethod, completionCheckNotes });
      setAddOpen(false); setEditingScope(null); setDescription(""); setCompletionCheckMethod("customer_checkin"); setCompletionCheckNotes(""); router.refresh();
    } catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  async function removeScope(scope: MaterialScope) {
    if (!window.confirm(`Remove ${scope.category.name}${scope.description ? ` — ${scope.description}` : ""}? The calendar appointment will remain, but its Production link will be removed.`)) return;
    setBusyId(scope.id); setError("");
    try { await deleteProductionScopeAction(jobId, scope.id); router.refresh(); }
    catch (caught) { setError(message(caught)); }
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

  async function unlinkAppointment(scope: MaterialScope, appointmentId: string) {
    setBusyId(scope.id); setError("");
    try { await unlinkMaterialScopeAppointmentAction({ jobId, scopeId: scope.id, appointmentId }); router.refresh(); }
    catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  async function setWorkOrder(appointment: CalendarAppointment, sent: boolean) {
    setBusyId(appointment.id); setError("");
    try { await setInstallationWorkOrderSentAction(appointment.id, jobId, sent); router.refresh(); }
    catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  function beginCompletionCheck(scope: MaterialScope) {
    setCompletionScope(scope);
    setCompletionContact(scope.completion_contact_name ?? "");
    setCompletionContactMethod(scope.completion_contact_method ?? "phone");
    setCompletionOutcome(scope.completion_check_status === "issue" ? "issue" : "satisfied");
    setNote(scope.completion_check_notes ?? "");
    setError("");
  }

  async function saveCompletionCheck() {
    if (!completionScope) return;
    setBusyId(completionScope.id); setError("");
    try {
      await recordCompletionCheckAction({ jobId, scopeId: completionScope.id, contactName: completionContact, contactMethod: completionContactMethod, outcome: completionOutcome, notes: note });
      setCompletionScope(null); router.refresh();
    } catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  async function resetCompletion(scope: MaterialScope) {
    setBusyId(scope.id); setError("");
    try { await resetCompletionCheckAction(jobId, scope.id); router.refresh(); }
    catch (caught) { setError(message(caught)); }
    finally { setBusyId(null); }
  }

  return <section className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/70 shadow-sm">
    <header className="border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-semibold text-gray-950">Production</h3><p className="mt-0.5 text-xs text-gray-500">Materials, scheduling, crews, and work orders for this job.</p></div>
        <div className="flex items-center gap-2"><span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">{summary.completed_steps} of {summary.total_steps} steps complete</span><Button type="button" onClick={beginAdd}><Plus /> Add Scope</Button></div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-gray-100 pt-2.5">
        <SummaryStat icon={<Package />} label={`${summary.materials_ready}/${summary.materials_total} materials ready`} attention={summary.materials_ready < summary.materials_total} />
        <SummaryStat icon={<CalendarDays />} label={`${summary.installations_scheduled}/${summary.installations_required} installations scheduled`} attention={summary.installations_scheduled < summary.installations_required} />
        <SummaryStat icon={<Send />} label={`${summary.work_orders_sent}/${summary.work_orders_required} work orders sent`} attention={summary.work_orders_sent < summary.work_orders_required} />
        <SummaryStat icon={<MapPinned />} label={`${summary.job_walks_completed}/${summary.job_walks_required} completion checks complete`} attention={summary.job_walks_completed < summary.job_walks_required} />
      </div>
    </header>

    {error ? <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

    <div className="space-y-2.5 p-3 sm:p-4">
      {scopes.length ? scopes.map((scope) => {
        const linkedInstallationSummary = scope.appointments.find((item) => item.appointment_type === "installation" && item.status !== "cancelled");
        const linkedInstallation = linkedInstallationSummary ? appointments.find((item) => item.id === linkedInstallationSummary.id) : null;
        const linkedJobWalk = scope.appointments.find((item) => item.appointment_type === "job_walk" && item.status !== "cancelled");
        const workOrderSent = linkedInstallation ? ["sent", "acknowledged"].includes(linkedInstallation.work_order_status) : false;
        const scheduled = Boolean(linkedInstallationSummary);
        const completionComplete = scope.completion_check_method === "job_walk"
          ? linkedJobWalk?.status === "completed"
          : scope.completion_check_status === "completed" || scope.completion_check_method === "not_required";
        return <article key={scope.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm ${scope.material_status === "issue" ? "border-red-300" : "border-gray-200"}`}>
          <div className="flex items-start justify-between gap-3 px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white ${categoryColor(scope.category.color_key)}`}>{scope.category.abbreviation}</span>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-gray-950">{scope.category.name}{scope.description ? ` — ${scope.description}` : ""}</h4><StatusBadge scope={scope} /></div><p className="mt-0.5 text-[11px] text-gray-500">{scope.eta_date ? `Material expected ${formatDate(scope.eta_date)}` : scope.ordering_required ? "Material ETA not entered" : "Material ordering not required"}</p></div>
            </div>
            <ScopeMenu scope={scope} linkedInstallationId={linkedInstallationSummary?.id} linkedJobWalkId={linkedJobWalk?.id} busy={busyId !== null} onEdit={() => beginEdit(scope)} onIssue={() => openStatus(scope, "issue")} onExclude={() => openStatus(scope, "excluded")} onReset={() => void saveStatus(scope, "needs_ordering", null, null)} onResetCompletion={() => void resetCompletion(scope)} onUnlink={(id) => void unlinkAppointment(scope, id)} onDelete={() => void removeScope(scope)} />
          </div>

          {scope.material_status === "issue" ? <div className="mx-3 mb-2 flex gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 sm:mx-4"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div><p className="font-semibold">Production issue needs attention</p><p className="mt-0.5 leading-4">{scope.issue_note || "No issue details entered."}</p></div></div> : null}

          <div className="grid border-t border-gray-100 lg:grid-cols-[minmax(360px,1.05fr)_minmax(0,1fr)] lg:items-stretch">
          <div className="bg-gray-50/70 px-3 py-2.5 sm:px-4 lg:border-r lg:border-gray-100"><ScopeMilestones scope={scope} scheduled={scheduled} workOrderSent={workOrderSent} completionComplete={Boolean(completionComplete)} /></div>

          <div className="grid gap-2 border-t border-gray-100 px-3 py-2.5 sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:border-t-0">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Installation</p>
              {linkedInstallation ? <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="font-semibold text-gray-950">{linkedInstallation.installer_crew?.name ?? "Unassigned crew"}</span><span className="inline-flex items-center gap-1 text-gray-600"><CalendarDays className="h-3.5 w-3.5" />{formatRange(linkedInstallation.starts_at, linkedInstallation.ends_at)}</span><span className={`inline-flex items-center gap-1 font-medium ${workOrderSent ? "text-emerald-700" : "text-amber-700"}`}><ClipboardList className="h-3.5 w-3.5" />{workOrderSent ? "Work order sent" : "Work order pending"}</span></div> : <p className="mt-1 text-xs text-gray-500">No crew or installation date scheduled.</p>}
              <CompletionCheckDetail scope={scope} linkedJobWalk={linkedJobWalk} />
            </div>
            <div className="flex flex-wrap gap-1.5 [&_button]:h-8 [&_button]:px-2.5 [&_button]:text-xs">
              {linkedInstallation ? <Button type="button" variant="outline" onClick={() => onEditInstallation(linkedInstallation)}><Pencil /> Edit</Button> : null}
              {linkedInstallation && scope.work_order_required ? <Button type="button" variant={workOrderSent ? "outline" : "default"} disabled={busyId !== null} onClick={() => void setWorkOrder(linkedInstallation, !workOrderSent)}><Send />{workOrderSent ? "Not sent" : "Send W.O."}</Button> : null}
              <NextAction scope={scope} scheduled={scheduled} jobWalkScheduled={Boolean(linkedJobWalk)} busy={busyId !== null} onStatus={openStatus} onSchedule={onSchedule} onCheckIn={beginCompletionCheck} />
            </div>
          </div></div>
        </article>;
      }) : <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center"><p className="font-semibold text-gray-950">No production scopes yet</p><p className="mt-1 text-sm text-gray-500">Add a material, demo, or labor scope to begin production planning.</p><Button type="button" className="mt-4" onClick={beginAdd}><Plus /> Add first scope</Button></div>}
      {!installationRequired ? <p className="text-xs text-gray-500">This job is marked as materials-only or customer-installed.</p> : null}
    </div>

    <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setEditingScope(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editingScope ? "Edit production scope" : "Add production scope"}</DialogTitle><DialogDescription>{editingScope ? "Changes to the scope or area also update its linked installation appointment." : "Add a material installation, demo crew, or labor-only phase. Each scope progresses independently."}</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-2 text-sm font-medium">Scope category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Scope or area<Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Locker rooms, demo, upstairs install…" /></label><label className="grid gap-2 text-sm font-medium">Completion check<select value={completionCheckMethod} onChange={(event) => setCompletionCheckMethod(event.target.value as CompletionCheckMethod)} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="job_walk">Job Walk</option><option value="customer_checkin">Customer Check-in</option><option value="not_required">Not Required</option></select><span className="text-xs font-normal text-gray-500">Choose how completed work will be confirmed. You can change this later.</span></label>{completionCheckMethod === "not_required" ? <label className="grid gap-2 text-sm font-medium">Why is it not required?<textarea value={completionCheckNotes} onChange={(event) => setCompletionCheckNotes(event.target.value)} rows={2} className="rounded-lg border border-gray-300 p-3 text-sm" placeholder="GC confirmed, commercial plans already accepted…" /></label> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="button" disabled={busyId !== null || (completionCheckMethod === "not_required" && !completionCheckNotes.trim())} onClick={() => void saveScope()}>{busyId ? "Saving…" : editingScope ? "Save changes" : "Add scope"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(statusDialog)} onOpenChange={(open) => !open && setStatusDialog(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{statusDialog?.status === "ordered" ? "Material ordered" : statusDialog?.status === "issue" ? "Report material issue" : "Exclude material step"}</DialogTitle><DialogDescription>{statusDialog?.scope.category.name}{statusDialog?.scope.description ? ` — ${statusDialog.scope.description}` : ""}</DialogDescription></DialogHeader><div className="grid gap-4 py-5">{statusDialog?.status === "ordered" ? <label className="grid gap-2 text-sm font-medium">Expected arrival date<Input type="date" value={etaDate} onChange={(event) => setEtaDate(event.target.value)} required /><span className="text-xs font-normal text-gray-500">Foundation uses this date to warn when material may arrive after the planned installation.</span></label> : <label className="grid gap-2 text-sm font-medium">{statusDialog?.status === "issue" ? "What needs attention?" : "Reason for exclusion"}<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="rounded-lg border border-gray-300 p-3 text-sm" autoFocus /></label>}{error ? <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button><Button type="button" disabled={!statusDialog || busyId !== null || (statusDialog.status === "ordered" && !etaDate)} onClick={() => statusDialog && void saveStatus(statusDialog.scope, statusDialog.status, etaDate || null, note || null)}>{busyId ? "Saving…" : "Save"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(completionScope)} onOpenChange={(open) => !open && setCompletionScope(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Customer completion check-in</DialogTitle><DialogDescription>Record who confirmed the completed work and whether anything still needs attention.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-2 text-sm font-medium">Person contacted<Input value={completionContact} onChange={(event) => setCompletionContact(event.target.value)} placeholder="Customer, GC, superintendent…" /></label><label className="grid gap-2 text-sm font-medium">Contact method<select value={completionContactMethod} onChange={(event) => setCompletionContactMethod(event.target.value as typeof completionContactMethod)} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option><option value="in_person">In person</option><option value="other">Other</option></select></label><label className="grid gap-2 text-sm font-medium">Outcome<select value={completionOutcome} onChange={(event) => setCompletionOutcome(event.target.value as typeof completionOutcome)} className="h-10 rounded-lg border border-gray-300 bg-white px-3"><option value="satisfied">Satisfied — completion confirmed</option><option value="issue">Issue reported — follow-up needed</option></select></label><label className="grid gap-2 text-sm font-medium">Notes<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="rounded-lg border border-gray-300 p-3 text-sm" placeholder={completionOutcome === "issue" ? "Describe the issue and next step…" : "Optional confirmation details…"} /></label>{error ? <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setCompletionScope(null)}>Cancel</Button><Button type="button" disabled={busyId !== null || !completionContact.trim() || (completionOutcome === "issue" && !note.trim())} onClick={() => void saveCompletionCheck()}>{busyId ? "Saving…" : "Save check-in"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

function SummaryStat({ icon, label, attention }: { icon: React.ReactNode; label: string; attention: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${attention ? "text-amber-700" : "text-emerald-700"}`}><span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>{label}</span>;
}

function ScopeMilestones({ scope, scheduled, workOrderSent, completionComplete }: { scope: MaterialScope; scheduled: boolean; workOrderSent: boolean; completionComplete: boolean }) {
  const excluded = scope.material_status === "excluded";
  const ordered = excluded || !scope.ordering_required || ["ordered", "partially_received", "ready"].includes(scope.material_status);
  const ready = excluded || !scope.ordering_required || scope.material_status === "ready";
  const steps = [
    { label: "Ordered", complete: ordered, required: scope.ordering_required },
    { label: "Ready", complete: ready, required: scope.ordering_required },
    { label: "Scheduled", complete: excluded || scheduled || !scope.installation_required, required: scope.installation_required },
    { label: "Work Order", complete: excluded || workOrderSent || !scope.work_order_required, required: scope.work_order_required },
    { label: "Completion", complete: excluded || completionComplete, required: scope.completion_check_method !== "not_required" },
  ];
  return <div className="grid grid-cols-5 gap-1">{steps.map((step, index) => <div key={step.label} className="relative flex min-w-0 flex-col items-center text-center">{index ? <span className={`absolute top-2.5 right-1/2 left-[-50%] h-px ${steps[index - 1].complete && step.complete ? "bg-emerald-500" : "bg-gray-300"}`} /> : null}<span className={`relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border ${!step.required ? "border-gray-300 bg-gray-100 text-gray-400" : step.complete ? "border-emerald-600 bg-emerald-600 text-white" : scope.material_status === "issue" && index < 2 ? "border-red-400 bg-red-50 text-red-600" : "border-gray-300 bg-white text-gray-300"}`}>{step.complete ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}</span><span className="mt-1 truncate text-[8px] font-semibold uppercase tracking-wide text-gray-500 sm:text-[9px]">{step.label}</span></div>)}</div>;
}

function NextAction({ scope, scheduled, jobWalkScheduled, busy, onStatus, onSchedule, onCheckIn }: { scope: MaterialScope; scheduled: boolean; jobWalkScheduled: boolean; busy: boolean; onStatus: (scope: MaterialScope, status: MaterialStatus) => void; onSchedule: (scopeId?: string, type?: "installation" | "job_walk") => void; onCheckIn: (scope: MaterialScope) => void }) {
  if (scope.material_status === "excluded") return null;
  if (scope.material_status === "issue") return <Button type="button" disabled={busy} onClick={() => onStatus(scope, "issue")}><AlertTriangle /> Review issue</Button>;
  if (scope.ordering_required && !["ordered", "partially_received", "ready", "excluded"].includes(scope.material_status)) return <Button type="button" disabled={busy} onClick={() => onStatus(scope, "ordered")}><Package /> Mark ordered</Button>;
  if (scope.ordering_required && scope.material_status !== "ready") return <Button type="button" disabled={busy} onClick={() => onStatus(scope, "ready")}><Check /> Mark ready</Button>;
  if (scope.installation_required && !scheduled) return <Button type="button" disabled={busy} onClick={() => onSchedule(scope.id)}><CalendarDays /> Schedule installation</Button>;
  if (scope.completion_check_method === "job_walk" && !jobWalkScheduled) return <Button type="button" disabled={busy} onClick={() => onSchedule(scope.id, "job_walk")}><MapPinned /> Schedule job walk</Button>;
  if (scope.completion_check_method === "customer_checkin" && scope.completion_check_status !== "completed") return <Button type="button" disabled={busy} onClick={() => onCheckIn(scope)}><MapPinned /> Record check-in</Button>;
  return null;
}

function ScopeMenu({ scope, linkedInstallationId, linkedJobWalkId, busy, onEdit, onIssue, onExclude, onReset, onResetCompletion, onUnlink, onDelete }: { scope: MaterialScope; linkedInstallationId?: string; linkedJobWalkId?: string; busy: boolean; onEdit: () => void; onIssue: () => void; onExclude: () => void; onReset: () => void; onResetCompletion: () => void; onUnlink: (id: string) => void; onDelete: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger render={<Button type="button" size="icon" variant="ghost" aria-label="Production scope options" disabled={busy} />}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={onEdit}><Pencil /> Edit scope</DropdownMenuItem><DropdownMenuItem onClick={onIssue}><AlertTriangle /> Report issue</DropdownMenuItem><DropdownMenuItem onClick={onExclude}>Exclude requirement</DropdownMenuItem>{scope.material_status !== "needs_ordering" ? <DropdownMenuItem onClick={onReset}>Reset material status</DropdownMenuItem> : null}{["completed", "issue"].includes(scope.completion_check_status) ? <DropdownMenuItem onClick={onResetCompletion}>Reset completion check</DropdownMenuItem> : null}{linkedInstallationId ? <DropdownMenuItem onClick={() => onUnlink(linkedInstallationId)}>Unlink installation</DropdownMenuItem> : null}{linkedJobWalkId ? <DropdownMenuItem onClick={() => onUnlink(linkedJobWalkId)}>Unlink job walk</DropdownMenuItem> : null}<DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 /> Delete scope</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function CompletionCheckDetail({ scope, linkedJobWalk }: { scope: MaterialScope; linkedJobWalk?: MaterialScope["appointments"][number] }) {
  if (scope.completion_check_method === "not_required") return <p className="mt-1 text-[11px] text-gray-500">Completion check: Not required{scope.completion_check_notes ? ` — ${scope.completion_check_notes}` : ""}</p>;
  if (scope.completion_check_method === "job_walk") return <p className="mt-1 text-[11px] text-gray-500">Completion check · Job Walk: {linkedJobWalk ? linkedJobWalk.status === "completed" ? "Completed" : `Scheduled ${formatDateTime(linkedJobWalk.starts_at)}` : "Not scheduled"}</p>;
  const method = scope.completion_contact_method?.replace("_", " ");
  return <p className={`mt-1 text-[11px] ${scope.completion_check_status === "issue" ? "font-medium text-red-700" : "text-gray-500"}`}>Completion check · Customer: {scope.completion_check_status === "completed" ? `Confirmed by ${scope.completion_contact_name}${method ? ` via ${method}` : ""}` : scope.completion_check_status === "issue" ? `Issue reported${scope.completion_contact_name ? ` by ${scope.completion_contact_name}` : ""}` : "Pending"}</p>;
}
function StatusBadge({ scope }: { scope: MaterialScope }) {
  const style = scope.material_status === "ready" ? "bg-emerald-50 text-emerald-700" : scope.material_status === "issue" ? "bg-red-50 text-red-700" : scope.material_status === "excluded" ? "bg-gray-100 text-gray-600" : scope.material_status === "ordered" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style}`}>{scope.material_status.split("_").join(" ")}</span>;
}
function message(error: unknown) { return productionPipelineErrorMessage(error, "Unable to update production."); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }
function formatRange(start: string, end: string | null) { const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }); const first = formatter.format(new Date(start)); const last = end ? formatter.format(new Date(end)) : first; return first === last ? first : `${first} – ${last}`; }
function categoryColor(key: string) { return ({ blue: "bg-[#3f6e8c]", amber: "bg-[#c89c45]", violet: "bg-violet-600", orange: "bg-orange-600", emerald: "bg-[#5d8a52]", cyan: "bg-cyan-600", indigo: "bg-indigo-600", teal: "bg-teal-600", red: "bg-[#b14e4e]", gray: "bg-[#8f969c]" } as Record<string, string>)[key] ?? "bg-[#8f969c]"; }

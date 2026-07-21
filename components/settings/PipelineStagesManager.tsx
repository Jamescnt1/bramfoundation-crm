"use client";

import { useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowUp, LockKeyhole, Pencil, Plus, X } from "lucide-react";
import {
  archivePipelineStageAction,
  createPipelineStageAction,
  reorderPipelineStagesAction,
  updatePipelineStageAction,
} from "@/app/settings/pipeline/actions";
import type { PipelineColorKey, PipelineStageConfig, PipelineStageValues } from "@/lib/services/pipeline-stages";

const colors: { key: PipelineColorKey; label: string; dot: string }[] = [
  { key: "blue", label: "Blue", dot: "bg-blue-500" },
  { key: "amber", label: "Amber", dot: "bg-amber-500" },
  { key: "violet", label: "Violet", dot: "bg-violet-500" },
  { key: "orange", label: "Orange", dot: "bg-orange-500" },
  { key: "emerald", label: "Emerald", dot: "bg-emerald-500" },
  { key: "cyan", label: "Cyan", dot: "bg-cyan-500" },
  { key: "indigo", label: "Indigo", dot: "bg-indigo-500" },
  { key: "teal", label: "Teal", dot: "bg-teal-600" },
  { key: "red", label: "Red", dot: "bg-red-500" },
  { key: "gray", label: "Gray", dot: "bg-gray-500" },
];

const emptyStage: PipelineStageValues = {
  slug: "",
  label: "",
  color_key: "blue",
  sort_order: 0,
  active: true,
  terminal: false,
  lead_queue: false,
  qf_number_required: true,
  system_required: false,
  behavior: {},
};

export default function PipelineStagesManager({ initialStages }: { initialStages: PipelineStageConfig[] }) {
  const [stages, setStages] = useState(initialStages);
  const [draft, setDraft] = useState<PipelineStageValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeStages = useMemo(() => stages.filter((stage) => stage.active), [stages]);

  function values(stage: PipelineStageConfig): PipelineStageValues {
    return {
      slug: stage.slug, label: stage.label, color_key: stage.color_key,
      sort_order: stage.sort_order, active: stage.active, terminal: stage.terminal,
      lead_queue: stage.lead_queue, qf_number_required: stage.qf_number_required,
      system_required: stage.system_required, behavior: stage.behavior,
    };
  }

  function beginCreate() {
    setEditingId("new");
    setDraft({ ...emptyStage, sort_order: stages.length });
    setError("");
  }

  function beginEdit(stage: PipelineStageConfig) {
    setEditingId(stage.id);
    setDraft(values(stage));
    setError("");
  }

  async function save() {
    if (!draft) return;
    const label = draft.label.trim().replace(/\s+/g, " ");
    const slug = draft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!label) return setError("Stage label cannot be blank.");
    if (!slug) return setError("Stage slug cannot be blank.");
    if (stages.some((stage) => stage.id !== editingId && stage.label.trim().toLowerCase() === label.toLowerCase())) return setError("A stage with that name already exists.");
    if (stages.some((stage) => stage.id !== editingId && stage.slug === slug)) return setError("A stage with that internal identifier already exists.");

    await run(async () => {
      const normalized = { ...draft, label, slug };
      if (editingId === "new") await createPipelineStageAction(normalized);
      else if (editingId) await updatePipelineStageAction(editingId, normalized);
      window.location.reload();
    });
  }

  async function move(index: number, offset: -1 | 1) {
    const ordered = stages.filter((stage) => stage.active);
    const target = index + offset;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const archived = stages.filter((stage) => !stage.active);
    const normalized = [...ordered.map((stage, sort_order) => ({ ...stage, sort_order })), ...archived];
    const previous = stages;
    setStages(normalized);
    await run(async () => {
      try {
        await reorderPipelineStagesAction(ordered.map((stage) => ({ id: stage.id, values: values(stage) })));
      } catch (caught) {
        setStages(previous);
        throw caught;
      }
    });
  }

  async function archive(stage: PipelineStageConfig) {
    if (stage.system_required) return;
    const explanation = stage.job_count
      ? `\n\n${stage.job_count} existing job(s) use this stage. Choose OK to archive it while preserving those historical statuses. Choose Cancel if you want to reassign them first.`
      : "";
    if (!window.confirm(`Archive “${stage.label}”? It will be hidden from new status choices.${explanation}`)) return;
    await run(async () => {
      await archivePipelineStageAction(stage.id);
      setStages((current) => current.map((item) => item.id === stage.id ? { ...item, active: false } : item));
      setMessage(`${stage.label} was archived. Historical job references were preserved.`);
    });
  }

  async function restore(stage: PipelineStageConfig) {
    await run(async () => {
      const updated = { ...values(stage), active: true, sort_order: activeStages.length };
      await updatePipelineStageAction(stage.id, updated);
      setStages((current) => current.map((item) => item.id === stage.id ? { ...item, ...updated } : item));
      setMessage(`${stage.label} was restored.`);
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update pipeline settings."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold text-gray-900">Pipeline stages</h2><p className="mt-1 text-sm text-gray-500">Order, label, color, and behavior are shared everywhere in the CRM.</p></div>
        <button type="button" onClick={beginCreate} disabled={busy || editingId === "new"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"><Plus className="h-4 w-4" /> Add Stage</button>
      </div>

      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
      {editingId === "new" && draft ? <StageEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => { setDraft(null); setEditingId(null); }} busy={busy} isNew /> : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {activeStages.map((stage, index) => (
          <div key={stage.id} className="border-b border-gray-100 last:border-0">
            {editingId === stage.id && draft ? (
              <StageEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => { setDraft(null); setEditingId(null); }} busy={busy} lockedSlug={stage.system_required} />
            ) : (
              <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${colors.find((color) => color.key === stage.color_key)?.dot}`} />
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-gray-900">{stage.label}</p>{stage.system_required ? <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"><LockKeyhole className="h-3 w-3" /> Required</span> : null}{stage.terminal ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Terminal</span> : null}</div><p className="mt-1 text-xs text-gray-500">{stage.job_count} job{stage.job_count === 1 ? "" : "s"} · {stage.slug}{stage.lead_queue ? " · Leads queue" : ""}{stage.qf_number_required ? " · QF# required" : ""}</p></div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={busy || index === 0} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label={`Move ${stage.label} up`}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={busy || index === activeStages.length - 1} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label={`Move ${stage.label} down`}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => beginEdit(stage)} disabled={busy} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={`Edit ${stage.label}`}><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => archive(stage)} disabled={busy || stage.system_required} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30" title={stage.system_required ? "Required system stages cannot be archived." : "Archive stage"} aria-label={`Archive ${stage.label}`}><Archive className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {stages.some((stage) => !stage.active) ? <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-gray-900">Archived stages</h2><p className="mt-1 text-sm text-gray-500">Hidden from new status choices but retained on historical jobs.</p><div className="mt-4 divide-y divide-gray-100">{stages.filter((stage) => !stage.active).map((stage) => <div key={stage.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-medium text-gray-700">{stage.label}</p><p className="text-xs text-gray-500">{stage.job_count} historical job{stage.job_count === 1 ? "" : "s"}</p></div><button type="button" onClick={() => restore(stage)} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Restore</button></div>)}</div></section> : null}
    </div>
  );
}

function StageEditor({ draft, setDraft, onSave, onCancel, busy, isNew = false, lockedSlug = false }: { draft: PipelineStageValues; setDraft: (value: PipelineStageValues) => void; onSave: () => void; onCancel: () => void; busy: boolean; isNew?: boolean; lockedSlug?: boolean }) {
  const field = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black";
  return <div className={`space-y-4 p-5 ${isNew ? "rounded-xl border border-gray-200 bg-white shadow-sm" : "bg-gray-50"}`}>
    <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-gray-700">Display name<input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value, slug: isNew ? event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : draft.slug })} className={`mt-1.5 ${field}`} /></label><label className="text-sm font-medium text-gray-700">Internal identifier<input value={draft.slug} disabled={lockedSlug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} className={`mt-1.5 ${field} disabled:bg-gray-100 disabled:text-gray-500`} /><span className="mt-1 block text-xs font-normal text-gray-500">Stable identifier used by business rules.</span></label><label className="text-sm font-medium text-gray-700">Color<select value={draft.color_key} onChange={(event) => setDraft({ ...draft, color_key: event.target.value as PipelineColorKey })} className={`mt-1.5 ${field}`}>{colors.map((color) => <option key={color.key} value={color.key}>{color.label}</option>)}</select></label></div>
    <div className="grid gap-3 sm:grid-cols-3"><Check label="Show in Leads queue" checked={draft.lead_queue} onChange={(checked) => setDraft({ ...draft, lead_queue: checked })} /><Check label="Require QF#" checked={draft.qf_number_required} onChange={(checked) => setDraft({ ...draft, qf_number_required: checked })} /><Check label="Terminal stage" checked={draft.terminal} onChange={(checked) => setDraft({ ...draft, terminal: checked })} /></div>
    <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"><X className="h-4 w-4" /> Cancel</button><button type="button" onClick={onSave} disabled={busy} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">{busy ? "Saving..." : "Save Stage"}</button></div>
  </div>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />{label}</label>;
}

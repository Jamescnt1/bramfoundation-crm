"use client";
/* eslint-disable @next/next/no-img-element -- private signed layout URLs are generated at request time */

import {
  Archive,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  History,
  Pencil,
  Printer,
  RefreshCw,
  Share2,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveLayout, updateLayoutMetadata } from "@/app/actions/job-layouts";
import {
  getQueuedLayoutImports,
  queueLayoutImport,
  removeQueuedLayoutImport,
  type QueuedLayoutImport,
} from "@/components/layouts/import-offline-store";
import type { JobLayout } from "@/components/layouts/types";

type Props = {
  jobId: string;
  customerName: string;
  jobName: string;
  qfNumber: string | null;
  initialLayouts: JobLayout[];
  canManage: boolean;
  canArchive: boolean;
  error?: string;
};

type ImportDraft = {
  file: File | null;
  layoutName: string;
  roomOrArea: string;
  notes: string;
  replaceLayoutId: string;
};

const EMPTY_DRAFT: ImportDraft = {
  file: null,
  layoutName: "",
  roomOrArea: "",
  notes: "",
  replaceLayoutId: "",
};
const PRIMARY_BUTTON = "inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON = "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const ICON_BUTTON = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50";

export default function LayoutWorkspace({
  jobId,
  customerName,
  jobName,
  qfNumber,
  initialLayouts,
  canManage,
  canArchive,
  error,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(initialLayouts.find((layout) => layout.is_latest)?.id ?? initialLayouts[0]?.id ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [draft, setDraft] = useState<ImportDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [queued, setQueued] = useState<QueuedLayoutImport[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const visibleLayouts = useMemo(
    () => initialLayouts.filter((layout) => showHistory || layout.is_latest),
    [initialLayouts, showHistory],
  );
  const selected = initialLayouts.find((layout) => layout.id === selectedId) ?? visibleLayouts[0] ?? null;
  const versionHistory = selected
    ? initialLayouts.filter((layout) => rootLayoutId(layout, initialLayouts) === rootLayoutId(selected, initialLayouts))
    : [];

  const refreshQueue = useCallback(async () => {
    try {
      setQueued(await getQueuedLayoutImports(jobId));
    } catch {
      // Private browsing/storage restrictions should not block normal online imports.
    }
  }, [jobId]);

  const uploadQueued = useCallback(async (item: QueuedLayoutImport) => {
    const file = new File([item.file], item.fileName, { type: item.fileType });
    await uploadImport(jobId, {
      file,
      layoutName: item.layoutName,
      roomOrArea: item.roomOrArea,
      notes: item.notes,
      replaceLayoutId: item.replaceLayoutId,
    });
    await removeQueuedLayoutImport(item.id);
  }, [jobId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshQueue(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshQueue]);

  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine || busy) return;
      const items = await getQueuedLayoutImports(jobId).catch(() => []);
      if (!items.length) return;
      setBusy(true);
      setProgress(`Syncing ${items.length} queued ${items.length === 1 ? "layout" : "layouts"}…`);
      try {
        for (const item of items) await uploadQueued(item);
        setSuccess("Queued layout imports synced.");
        router.refresh();
      } catch (caught) {
        setActionError(message(caught));
      } finally {
        setBusy(false);
        setProgress("");
        await refreshQueue();
      }
    };
    window.addEventListener("online", sync);
    void sync();
    return () => window.removeEventListener("online", sync);
  }, [busy, jobId, refreshQueue, router, uploadQueued]);

  function chooseFile(file: File | null) {
    if (!file) return;
    const suggested = `${customerName} - ${jobName} - Layout - ${localDateKey(new Date())}`;
    setDraft((current) => ({
      ...current,
      file,
      layoutName: current.layoutName || suggested,
    }));
    setImportOpen(true);
  }

  async function confirmImport() {
    if (!draft.file || !draft.layoutName.trim()) {
      setActionError("Choose a file and enter a layout name.");
      return;
    }
    setBusy(true);
    setActionError("");
    setSuccess("");
    setProgress(navigator.onLine ? "Uploading layout…" : "Saving layout to this device…");
    const extension = fileExtension(draft.file.name);
    const uploadName = `${draft.layoutName.trim()}${extension ? `.${extension}` : ""}`;
    const item: QueuedLayoutImport = {
      id: crypto.randomUUID(),
      jobId,
      layoutName: draft.layoutName.trim(),
      roomOrArea: draft.roomOrArea.trim(),
      notes: draft.notes.trim(),
      replaceLayoutId: draft.replaceLayoutId,
      file: draft.file,
      fileName: uploadName,
      fileType: draft.file.type,
      queuedAt: new Date().toISOString(),
    };

    try {
      await queueLayoutImport(item);
      if (!navigator.onLine) {
        setSuccess("Saved on this device. Foundation will upload it when this browser reconnects.");
      } else {
        await uploadQueued(item);
        setSuccess(draft.replaceLayoutId ? "New layout version saved." : "Layout imported successfully.");
        router.refresh();
      }
      setDraft(EMPTY_DRAFT);
      setImportOpen(false);
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setActionError(`${message(caught)} The selected file remains queued on this device when browser storage is available.`);
    } finally {
      setBusy(false);
      setProgress("");
      await refreshQueue();
    }
  }

  function beginEdit() {
    if (!selected) return;
    setEditName(selected.name);
    setEditRoom(selected.room_or_area ?? "");
    setEditNotes(selected.notes ?? "");
    setEditing(true);
  }

  async function saveMetadata() {
    if (!selected) return;
    setBusy(true);
    setActionError("");
    try {
      await updateLayoutMetadata({
        layoutId: selected.id,
        jobId,
        name: editName,
        roomOrArea: editRoom || null,
        notes: editNotes || null,
      });
      setEditing(false);
      setSuccess("Layout details updated.");
      router.refresh();
    } catch (caught) {
      setActionError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!selected || !window.confirm(`Archive "${selected.name}"? The Job File will remain available.`)) return;
    setBusy(true);
    setActionError("");
    try {
      await archiveLayout({ jobId, layoutId: selected.id });
      setSelectedId(initialLayouts.find((layout) => layout.id !== selected.id && layout.is_latest)?.id ?? "");
      setSuccess("Layout archived. Its underlying Job File was preserved.");
      router.refresh();
    } catch (caught) {
      setActionError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  function replaceSelected() {
    if (!selected) return;
    setDraft({
      ...EMPTY_DRAFT,
      layoutName: selected.name,
      roomOrArea: selected.room_or_area ?? "",
      notes: selected.notes ?? "",
      replaceLayoutId: selected.id,
    });
    setImportOpen(true);
    window.setTimeout(() => inputRef.current?.click(), 0);
  }

  return (
    <div className="space-y-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {queued.length ? (
        <Notice tone="warning">
          <span className="inline-flex items-center gap-2"><WifiOff className="h-4 w-4" /> {queued.length} import {queued.length === 1 ? "is" : "are"} waiting to sync on this device.</span>
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <div>
          <p className="text-sm font-bold text-gray-950">Job layouts</p>
          <p className="text-xs text-gray-500">Export from Note Taker HD, save to Files, then import here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {initialLayouts.some((layout) => !layout.is_latest) ? (
            <button type="button" onClick={() => setShowHistory((value) => !value)} className={SECONDARY_BUTTON}>
              <History className="h-4 w-4" /> {showHistory ? "Latest only" : "Version history"}
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => { setDraft(EMPTY_DRAFT); setImportOpen(true); }} className={PRIMARY_BUTTON}>
              <Upload className="h-4 w-4" /> Import from Note Taker
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="max-h-[680px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
          {visibleLayouts.length ? visibleLayouts.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => { setSelectedId(layout.id); setEditing(false); }}
              className={`w-full rounded-md border p-2 text-left ${selected?.id === layout.id ? "border-gray-900 bg-white shadow-sm" : "border-transparent hover:bg-white"}`}
            >
              <div className="flex items-start gap-2">
                {layout.mime_type?.startsWith("image/") && layout.file_url ? (
                  <img src={layout.file_url} alt="" className="h-14 w-14 rounded border border-gray-200 object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-400">
                    {layout.record_kind === "legacy_drawing" ? <Pencil className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-gray-950">{layout.name}</p>
                  <p className="mt-1 truncate text-[11px] text-gray-500">{layout.room_or_area || (layout.record_kind === "legacy_drawing" ? "Legacy drawing" : "Layout")}</p>
                  <p className="mt-1 text-[10px] text-gray-400">v{layout.version_number} · {formatDate(layout.updated_at)}</p>
                </div>
              </div>
            </button>
          )) : (
            <div className="p-6 text-center">
              <FileImage className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-xs font-semibold text-gray-700">No imported layouts</p>
            </div>
          )}
        </aside>

        <section className="min-h-[440px] overflow-hidden rounded-lg border border-gray-200 bg-white">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-950">{selected.name}</h3>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                      {selected.record_kind === "legacy_drawing" ? "Legacy drawing · read only" : `Version ${selected.version_number}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {[selected.room_or_area, selected.file_name, formatBytes(selected.file_size)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.file_url ? <>
                    <a href={selected.file_url} download={selected.file_name ?? selected.name} className={ICON_BUTTON} title="Download"><Download className="h-4 w-4" /></a>
                    <button type="button" onClick={() => void shareLayout(selected)} className={ICON_BUTTON} title="Share"><Share2 className="h-4 w-4" /></button>
                    <button type="button" onClick={() => printUrl(selected.file_url)} className={ICON_BUTTON} title="Print"><Printer className="h-4 w-4" /></button>
                  </> : null}
                  {canManage && selected.record_kind === "imported_file" ? <>
                    <button type="button" onClick={beginEdit} className={ICON_BUTTON} title="Edit details"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={replaceSelected} className={SECONDARY_BUTTON}><RefreshCw className="h-4 w-4" /> Replace / Update</button>
                  </> : null}
                  {canArchive ? <button type="button" onClick={() => void handleArchive()} className={`${ICON_BUTTON} text-red-700`} title="Archive"><Archive className="h-4 w-4" /></button> : null}
                </div>
              </div>

              {editing ? (
                <div className="grid gap-3 border-b border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
                  <Field label="Layout name"><input value={editName} onChange={(event) => setEditName(event.target.value)} /></Field>
                  <Field label="Room / area"><input value={editRoom} onChange={(event) => setEditRoom(event.target.value)} /></Field>
                  <Field label="Notes" wide><textarea rows={3} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} /></Field>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="button" disabled={busy} onClick={() => void saveMetadata()} className={PRIMARY_BUTTON}>Save details</button>
                    <button type="button" onClick={() => setEditing(false)} className={SECONDARY_BUTTON}>Cancel</button>
                  </div>
                </div>
              ) : null}

              <LayoutPreview layout={selected} />

              {selected.notes ? <div className="border-t border-gray-200 p-3 text-sm text-gray-600"><span className="font-semibold text-gray-900">Notes:</span> {selected.notes}</div> : null}
              {versionHistory.length > 1 ? (
                <div className="border-t border-gray-200 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Versions</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {versionHistory.sort((a, b) => b.version_number - a.version_number).map((version) => (
                      <button key={version.id} type="button" onClick={() => setSelectedId(version.id)} className={`rounded border px-2 py-1 text-xs ${version.id === selected.id ? "border-black bg-black text-white" : "border-gray-300"}`}>
                        v{version.version_number} · {formatDate(version.created_at)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-[440px] flex-col items-center justify-center p-8 text-center">
              <Upload className="h-9 w-9 text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-900">Import a Note Taker layout</p>
              <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">PDF and image imports are stored privately, searchable, versioned, and automatically available in Job Files.</p>
            </div>
          )}
        </section>
      </div>

      {importOpen ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-3 sm:flex sm:items-center sm:justify-center">
          <div className="my-3 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:my-0">
            <div className="flex shrink-0 items-start justify-between border-b border-gray-200 p-4">
              <div>
                <h2 className="font-bold text-gray-950">{draft.replaceLayoutId ? "Replace / Update Layout" : "Import from Note Taker"}</h2>
                <p className="mt-1 text-xs text-gray-500">{customerName} · {jobName}{qfNumber ? ` · QF# ${qfNumber}` : ""}</p>
              </div>
              <button type="button" onClick={() => !busy && setImportOpen(false)} className={ICON_BUTTON}><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [-webkit-overflow-scrolling:touch]">
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-5 text-center">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                <FileText className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm font-semibold text-gray-800">{draft.file?.name ?? "Choose the export from iPad Files"}</p>
                {draft.file ? <p className="mt-1 text-xs text-gray-500">{formatBytes(draft.file.size)}</p> : null}
                <button type="button" onClick={() => inputRef.current?.click()} className={`${SECONDARY_BUTTON} mt-3`}>Browse Files</button>
              </div>

              <Field label="Layout name"><input value={draft.layoutName} maxLength={120} onChange={(event) => setDraft((value) => ({ ...value, layoutName: event.target.value }))} placeholder={`${customerName} - ${jobName} - Layout - ${localDateKey(new Date())}`} /></Field>
              <Field label="Room / area (optional)"><input value={draft.roomOrArea} maxLength={120} onChange={(event) => setDraft((value) => ({ ...value, roomOrArea: event.target.value }))} placeholder="Kitchen, whole house, stairs…" /></Field>
              <Field label="Notes (optional)"><textarea rows={3} value={draft.notes} maxLength={2000} onChange={(event) => setDraft((value) => ({ ...value, notes: event.target.value }))} /></Field>
              {!draft.replaceLayoutId ? (
                <Field label="Create new or replace existing">
                  <select value={draft.replaceLayoutId} onChange={(event) => {
                    const replacement = initialLayouts.find((layout) => layout.id === event.target.value);
                    setDraft((value) => ({
                      ...value,
                      replaceLayoutId: event.target.value,
                      layoutName: replacement?.name ?? value.layoutName,
                      roomOrArea: replacement?.room_or_area ?? value.roomOrArea,
                    }));
                  }}>
                    <option value="">Create a new layout</option>
                    {initialLayouts.filter((layout) => layout.is_latest).map((layout) => <option key={layout.id} value={layout.id}>Replace: {layout.name}</option>)}
                  </select>
                </Field>
              ) : null}
              <p className="text-xs leading-5 text-gray-500">The file is also listed in Job Files without creating a duplicate Storage copy. If connection fails, Foundation keeps a retry copy in this browser where iPadOS allows it.</p>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white p-4">
              <span className="text-xs font-medium text-gray-500">{progress}</span>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => setImportOpen(false)} className={SECONDARY_BUTTON}>Cancel</button>
                <button type="button" disabled={busy || !draft.file || !draft.layoutName.trim()} onClick={() => void confirmImport()} className={PRIMARY_BUTTON}>
                  {busy ? "Saving…" : "Save Layout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LayoutPreview({ layout }: { layout: JobLayout }) {
  const url = layout.file_url ?? layout.preview_url;
  if (!url) {
    return <div className="flex min-h-[360px] items-center justify-center bg-gray-50 p-8 text-center text-sm text-gray-500">No saved preview is available. The legacy editable data is preserved in the database.</div>;
  }
  if (layout.mime_type === "application/pdf") {
    return <iframe src={url} title={layout.name} className="h-[62vh] min-h-[420px] w-full bg-gray-100" />;
  }
  if (layout.mime_type?.startsWith("image/") || layout.record_kind === "legacy_drawing") {
    return <div className="flex min-h-[420px] items-center justify-center bg-gray-100 p-3"><img src={url} alt={layout.name} className="max-h-[68vh] max-w-full object-contain" /></div>;
  }
  return <div className="flex min-h-[360px] flex-col items-center justify-center bg-gray-50 p-8 text-center"><ExternalLink className="h-8 w-8 text-gray-300" /><a href={url} target="_blank" rel="noreferrer" className="mt-3 text-sm font-semibold underline">Open layout file</a></div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-gray-700 ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-md [&>input]:border [&>input]:border-gray-300 [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-md [&>select]:border [&>select]:border-gray-300 [&>select]:bg-white [&>select]:px-3 [&>textarea]:w-full [&>textarea]:rounded-md [&>textarea]:border [&>textarea]:border-gray-300 [&>textarea]:p-3">{children}</span></label>;
}

function Notice({ tone, children }: { tone: "error" | "success" | "warning"; children: React.ReactNode }) {
  const style = tone === "error" ? "border-red-200 bg-red-50 text-red-700" : tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return <div className={`rounded-md border px-3 py-2 text-sm ${style}`}>{children}</div>;
}

async function uploadImport(jobId: string, draft: Omit<ImportDraft, "file"> & { file: File }) {
  const formData = new FormData();
  formData.set("file", draft.file);
  formData.set("layoutName", draft.layoutName);
  formData.set("roomOrArea", draft.roomOrArea);
  formData.set("notes", draft.notes);
  formData.set("replaceLayoutId", draft.replaceLayoutId);
  const response = await fetch(`/api/jobs/${jobId}/layouts/import`, { method: "POST", body: formData });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Unable to import the layout.");
}

function rootLayoutId(layout: JobLayout, layouts: JobLayout[]): string {
  if (!layout.supersedes_layout_id) return layout.id;
  const parent = layouts.find((item) => item.id === layout.supersedes_layout_id);
  return parent ? rootLayoutId(parent, layouts) : layout.supersedes_layout_id;
}

function printUrl(url: string | null) {
  if (!url) return;
  const windowRef = window.open(url, "_blank", "noopener,noreferrer");
  windowRef?.addEventListener("load", () => windowRef.print(), { once: true });
}

async function shareLayout(layout: JobLayout) {
  if (!layout.file_url) return;
  if (navigator.share) {
    try {
      const response = await fetch(layout.file_url);
      const blob = await response.blob();
      const file = new File([blob], layout.file_name ?? layout.name, { type: layout.mime_type ?? blob.type });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ title: layout.name, files: [file] });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  window.open(layout.file_url, "_blank", "noopener,noreferrer");
}

function fileExtension(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "" : "";
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return null;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unable to complete the layout action.";
}

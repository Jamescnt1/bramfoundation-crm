"use client";
/* eslint-disable @next/next/no-img-element -- previews use short-lived private Supabase signed URLs */

import dynamic from "next/dynamic";
import { Archive, CloudOff, FilePlus2, LayoutTemplate, PencilRuler, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveLayout, createLayout, saveLayout } from "@/app/actions/job-layouts";
import type { JobLayout, LayoutDocument, LayoutTemplate as LayoutTemplateName } from "@/components/layouts/types";
import { clearOfflineDraft, getOfflineDraft, putOfflineDraft } from "@/components/layouts/offline-store";

const LayoutEditor = dynamic(() => import("@/components/layouts/LayoutEditor"), {
  ssr: false,
  loading: () => <div className="flex min-h-[560px] items-center justify-center bg-gray-100 text-sm text-gray-500">Loading drawing tools…</div>,
});

type Props = {
  jobId: string;
  initialLayouts: JobLayout[];
  canManage: boolean;
  canArchive: boolean;
  error?: string;
};

type SaveState = "saved" | "saving" | "offline" | "error" | "conflict";

export default function LayoutWorkspace({ jobId, initialLayouts, canManage, canArchive, error }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialLayouts[0]?.id ?? "");
  const selected = initialLayouts.find((layout) => layout.id === selectedId) ?? null;
  const [name, setName] = useState(selected?.name ?? "");
  const [document, setDocument] = useState<LayoutDocument | null>(selected?.document_data ?? null);
  const [updatedAt, setUpdatedAt] = useState(selected?.updated_at ?? "");
  const updatedAtRef = useRef(selected?.updated_at ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [dirtyRevision, setDirtyRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("Field Layout");
  const [template, setTemplate] = useState<LayoutTemplateName>("grid");
  const [actionError, setActionError] = useState("");
  const loadingDraftFor = useRef("");

  useEffect(() => {
    if (!selected || loadingDraftFor.current === selected.id) return;
    loadingDraftFor.current = selected.id;
    setName(selected.name);
    setDocument(selected.document_data);
    setUpdatedAt(selected.updated_at);
    updatedAtRef.current = selected.updated_at;
    setSaveState("saved");
    setDirtyRevision(0);

    void getOfflineDraft(selected.id).then((draft) => {
      if (!draft) return;
      const localIsNewer = new Date(draft.savedLocallyAt).getTime() > new Date(selected.updated_at).getTime();
      if (draft.pendingSync || localIsNewer) {
        setName(draft.name);
        setDocument(draft.document);
        setUpdatedAt(draft.expectedUpdatedAt);
        updatedAtRef.current = draft.expectedUpdatedAt;
        setSaveState(navigator.onLine ? "saving" : "offline");
        setDirtyRevision((value) => value + 1);
      }
    });
  }, [selected]);

  useEffect(() => {
    if (!selected || !document || dirtyRevision === 0) return;
    let cancelled = false;
    const localTimer = window.setTimeout(() => {
      void putOfflineDraft({
        layoutId: selected.id,
        jobId,
        name,
        document,
        expectedUpdatedAt: updatedAtRef.current,
        savedLocallyAt: new Date().toISOString(),
        pendingSync: true,
      });
    }, 100);
    const remoteTimer = window.setTimeout(async () => {
      if (!navigator.onLine) {
        if (!cancelled) setSaveState("offline");
        return;
      }
      if (!cancelled) setSaveState("saving");
      try {
        const result = await saveLayout({
          layoutId: selected.id,
          jobId,
          name,
          document,
          expectedUpdatedAt: updatedAtRef.current,
        });
        if (cancelled) return;
        setUpdatedAt(result.updated_at);
        updatedAtRef.current = result.updated_at;
        setSaveState("saved");
        await clearOfflineDraft(selected.id);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Unable to save the layout.";
        setActionError(message);
        setSaveState(message.includes("LAYOUT_CONFLICT") ? "conflict" : navigator.onLine ? "error" : "offline");
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(localTimer);
      window.clearTimeout(remoteTimer);
    };
  }, [dirtyRevision, document, jobId, name, selected]);

  useEffect(() => {
    const reconnect = () => {
      if (saveState === "offline") {
        setSaveState("saving");
        setDirtyRevision((value) => value + 1);
      }
    };
    const disconnect = () => setSaveState("offline");
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    return () => {
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", disconnect);
    };
  }, [saveState]);

  const savePreview = useCallback(async (blob: Blob) => {
    if (!selectedId || !navigator.onLine || !canManage) return;
    const formData = new FormData();
    formData.set("file", new File([blob], "preview.png", { type: "image/png" }));
    const response = await fetch(`/api/jobs/${jobId}/layouts/${selectedId}/preview`, { method: "POST", body: formData });
    const value = await response.json() as { error?: string; updatedAt?: string };
    if (!response.ok) {
      throw new Error(value.error ?? "Unable to save preview.");
    }
    if (value.updatedAt) {
      updatedAtRef.current = value.updatedAt;
      setUpdatedAt(value.updatedAt);
    }
    return value.updatedAt;
  }, [canManage, jobId, selectedId]);

  function choose(layout: JobLayout) {
    loadingDraftFor.current = "";
    setSelectedId(layout.id);
  }

  async function handleCreate() {
    setActionError("");
    try {
      const result = await createLayout({ jobId, name: createName, template });
      setCreating(false);
      router.refresh();
      window.setTimeout(() => setSelectedId(result.id), 0);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to create the layout.");
    }
  }

  async function handleArchive() {
    if (!selected || !window.confirm(`Archive "${selected.name}"?`)) return;
    setActionError("");
    try {
      await archiveLayout({ jobId, layoutId: selected.id });
      setSelectedId(initialLayouts.find((item) => item.id !== selected.id)?.id ?? "");
      router.refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to archive the layout.");
    }
  }

  return (
    <div>
      {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {actionError ? <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{actionError}</div> : null}

      <div className="grid overflow-hidden rounded-lg border border-gray-200 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 bg-gray-50 p-2 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <div>
              <p className="text-xs font-bold text-gray-900">Saved layouts</p>
              <p className="text-[10px] text-gray-500">{initialLayouts.length} for this job</p>
            </div>
            {canManage ? <button type="button" onClick={() => setCreating((value) => !value)} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-black text-white" aria-label="New layout"><Plus className="h-4 w-4" /></button> : null}
          </div>

          {creating ? (
            <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-white p-2">
              <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Layout name
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} maxLength={120} className="h-9 rounded-md border border-gray-300 px-2 text-sm font-normal normal-case tracking-normal text-gray-900" />
              </label>
              <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Template
                <select value={template} onChange={(event) => setTemplate(event.target.value as LayoutTemplateName)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm font-normal normal-case tracking-normal text-gray-900">
                  <option value="blank">Blank</option>
                  <option value="grid">Graph grid</option>
                  <option value="room">Room outline</option>
                </select>
              </label>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => void handleCreate()} className="flex-1 rounded-md bg-black px-2 py-2 text-xs font-semibold text-white">Create</button>
                <button type="button" onClick={() => setCreating(false)} className="rounded-md border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-600">Cancel</button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {initialLayouts.map((layout) => (
              <button
                key={layout.id}
                type="button"
                onClick={() => choose(layout)}
                className={`min-w-48 rounded-md border p-2 text-left lg:w-full lg:min-w-0 ${selectedId === layout.id ? "border-gray-900 bg-white shadow-sm" : "border-transparent hover:bg-white"}`}
              >
                {layout.preview_url ? <img src={layout.preview_url} alt="" className="mb-2 aspect-[14/9] w-full rounded border border-gray-200 bg-white object-cover" /> : <div className="mb-2 flex aspect-[14/9] items-center justify-center rounded border border-dashed border-gray-300 bg-white text-gray-300"><PencilRuler className="h-7 w-7" /></div>}
                <p className="truncate text-xs font-semibold text-gray-950">{layout.name}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">{layout.page_count} {layout.page_count === 1 ? "page" : "pages"} · {formatDate(layout.updated_at)}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 bg-white">
          {selected && document ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
                <div className="min-w-0">
                  {canManage ? (
                    <input
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setDirtyRevision((value) => value + 1);
                      }}
                      className="max-w-full rounded border border-transparent px-1 text-sm font-bold text-gray-950 hover:border-gray-300 focus:border-gray-400 focus:outline-none"
                    />
                  ) : <p className="text-sm font-bold text-gray-950">{name}</p>}
                  <p className="px-1 text-[10px] text-gray-500">
                    Editable field layout · {saveState === "offline" ? "changes stored on this device" : `last server save ${formatDateTime(updatedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {saveState === "offline" ? <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800"><CloudOff className="h-3 w-3" /> Offline</span> : null}
                  {canArchive ? <button type="button" onClick={() => void handleArchive()} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-red-200 px-2 text-[11px] font-semibold text-red-700 hover:bg-red-50"><Archive className="h-3.5 w-3.5" /> Archive</button> : null}
                </div>
              </div>
              <LayoutEditor
                jobId={jobId}
                name={name}
                document={document}
                canManage={canManage}
                saveState={saveState}
                onDocumentChange={(next) => {
                  setDocument(next);
                  setDirtyRevision((value) => value + 1);
                }}
                onPreview={savePreview}
              />
            </>
          ) : (
            <div className="flex min-h-[560px] flex-col items-center justify-center p-8 text-center">
              <LayoutTemplate className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-900">No layouts yet</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">Create a blank, grid, or room-template layout. Drawings stay editable and can be exported to Job Files.</p>
              {canManage ? <button type="button" onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-2 rounded-md bg-black px-3 py-2 text-xs font-semibold text-white"><FilePlus2 className="h-4 w-4" /> Create first layout</button> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

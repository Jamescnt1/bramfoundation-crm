"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createJobNoteAction, deleteJobNoteAction, updateJobNoteAction } from "@/app/actions/job-notes";
import type { JobNote } from "@/lib/services/job-notes";

type Props = {
  jobId: string;
  initialNotes: JobNote[];
  currentEmployeeId: string | null;
  currentEmployeeRole: string | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export default function JobNotesPanel({ jobId, initialNotes, currentEmployeeId, currentEmployeeRole, canCreate, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ordered = useMemo(() => [...notes].sort((a, b) => {
    const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return oldestFirst ? -delta : delta;
  }), [notes, oldestFirst]);

  async function addNote() {
    setBusy(true); setError("");
    try {
      const note = await createJobNoteAction({ jobId, body });
      setNotes((items) => [note, ...items]); setBody(""); router.refresh();
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function saveEdit(noteId: string) {
    setBusy(true); setError("");
    try {
      const note = await updateJobNoteAction({ noteId, jobId, body: editBody });
      setNotes((items) => items.map((item) => item.id === note.id ? note : item));
      setEditingId(null); router.refresh();
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function remove(noteId: string) {
    if (!window.confirm("Delete this job note? The audit record will be preserved.")) return;
    setBusy(true); setError("");
    try {
      await deleteJobNoteAction({ noteId, jobId });
      setNotes((items) => items.filter((item) => item.id !== noteId)); router.refresh();
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
        {canCreate ? (
          <div className="flex-1">
            <label htmlFor="job-note" className="text-xs font-semibold text-gray-700">Add a durable job note</label>
            <textarea id="job-note" rows={3} maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)}
              className="mt-1 max-h-48 min-h-20 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              placeholder="Record measurements, decisions, site conditions, or other lasting job information." />
            <button type="button" disabled={busy || !body.trim()} onClick={() => void addNote()} className="mt-2 rounded-md bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add Note</button>
          </div>
        ) : <p className="text-sm text-gray-500">You have view-only access to job notes.</p>}
        <button type="button" onClick={() => setOldestFirst((value) => !value)} className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700">
          {oldestFirst ? "Oldest first" : "Newest first"}
        </button>
      </div>
      {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="divide-y divide-gray-100">
        {ordered.map((note) => {
          const own = note.author_employee_id === currentEmployeeId;
          const fromJobForm = note.source === "job_form";
          const edited = Math.abs(new Date(note.updated_at).getTime() - new Date(note.created_at).getTime()) > 1000;
          return (
            <article key={note.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500"><strong className="text-gray-900">{fromJobForm ? "Job information note" : note.author?.name ?? "Former employee"}</strong> · {format(note.created_at)}
                  {edited ? <span title={`Edited ${format(note.updated_at)}`}> · Edited {format(note.updated_at)}</span> : null}</p>
                <div className="flex gap-2">
                  {fromJobForm ? <span className="text-xs font-medium text-gray-500">Edit in Edit Job Info</span> : null}
                  {!fromJobForm && canEdit && (own || currentEmployeeRole === "administrator") ? <button type="button" onClick={() => { setEditingId(note.id); setEditBody(note.body); }} className="text-xs font-semibold text-gray-600 hover:text-black">Edit</button> : null}
                  {!fromJobForm && canDelete ? <button type="button" disabled={busy} onClick={() => void remove(note.id)} className="text-xs font-semibold text-red-600">Delete</button> : null}
                </div>
              </div>
              {editingId === note.id ? (
                <div className="mt-2">
                  <textarea rows={3} maxLength={10000} value={editBody} onChange={(event) => setEditBody(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <div className="mt-2 flex gap-2"><button type="button" disabled={busy || !editBody.trim()} onClick={() => void saveEdit(note.id)} className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">Save</button><button type="button" onClick={() => setEditingId(null)} className="rounded-md border px-3 py-1.5 text-xs">Cancel</button></div>
                </div>
              ) : <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-gray-800">{note.body}</p>}
            </article>
          );
        })}
        {!ordered.length ? <p className="py-8 text-center text-sm text-gray-500">No durable job notes have been added.</p> : null}
      </div>
    </div>
  );
}

function format(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function message(error: unknown) { return error instanceof Error ? error.message : "Unable to update job notes."; }

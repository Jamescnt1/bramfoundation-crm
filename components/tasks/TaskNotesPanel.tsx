"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createTaskNoteAction,
  deleteTaskNoteAction,
  getTaskNotesAction,
  updateTaskNoteAction,
} from "@/app/actions/task-notes";
import type { TaskNote } from "@/components/tasks/types";

type Props = {
  taskId: string;
  currentEmployeeId: string | null;
  currentEmployeeRole: string | null;
  onLatestNoteChange: (note: TaskNote | null) => void;
};

export default function TaskNotesPanel({
  taskId,
  currentEmployeeId,
  currentEmployeeRole,
  onLatestNoteChange,
}: Props) {
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    getTaskNotesAction(taskId)
      .then((items) => {
        if (!active) return;
        setNotes(items);
        onLatestNoteChange(items[0] ?? null);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [taskId, onLatestNoteChange]);

  const ordered = useMemo(
    () => [...notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notes],
  );

  function publish(items: TaskNote[]) {
    setNotes(items);
    const latest = [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0] ?? null;
    onLatestNoteChange(latest);
  }

  async function addNote() {
    setBusy(true);
    setError("");
    try {
      const note = await createTaskNoteAction({ taskId, body });
      publish([note, ...notes]);
      setBody("");
      composerRef.current?.focus();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(noteId: string) {
    setBusy(true);
    setError("");
    try {
      const note = await updateTaskNoteAction({ noteId, taskId, body: editBody });
      publish(notes.map((item) => item.id === note.id ? note : item));
      setEditingId(null);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(noteId: string) {
    if (!window.confirm("Delete this task note? Its audit record will be preserved.")) return;
    setBusy(true);
    setError("");
    try {
      await deleteTaskNoteAction({ noteId, taskId });
      publish(notes.filter((item) => item.id !== noteId));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/70">
      <div className="border-b border-gray-200 p-3 sm:p-4">
        <label htmlFor={`task-note-${taskId}`} className="text-sm font-semibold text-gray-900">
          Add task note
        </label>
        <textarea
          ref={composerRef}
          id={`task-note-${taskId}`}
          rows={3}
          maxLength={10000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-2 max-h-40 min-h-20 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-black sm:text-sm"
          placeholder="Add an update, instruction, or follow-up note…"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{body.length.toLocaleString()} / 10,000</span>
          <button
            type="button"
            disabled={busy || !body.trim()}
            onClick={() => void addNote()}
            className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add note"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="m-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="max-h-72 divide-y divide-gray-200 overflow-y-auto overscroll-contain px-3 sm:max-h-80 sm:px-4">
        {loading ? <p className="py-5 text-sm text-gray-500">Loading note history…</p> : null}
        {!loading && !ordered.length ? (
          <p className="py-5 text-sm text-gray-500">No task notes yet.</p>
        ) : null}
        {ordered.map((note) => {
          const own = note.author_employee_id === currentEmployeeId;
          const editable = note.source !== "legacy_description"
            && (own || currentEmployeeRole === "administrator");
          const edited = new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 1000;
          return (
            <article key={note.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs leading-5 text-gray-500">
                  <strong className="text-gray-900">
                    {note.author?.name ?? (note.source === "legacy_description" ? "Legacy description" : "Former employee")}
                  </strong>
                  {" · "}
                  {formatDateTime(note.created_at)}
                  {edited ? (
                    <span title={`Edited ${formatDateTime(note.updated_at)}`}>
                      {" · "}Edited {formatDateTime(note.updated_at)}
                    </span>
                  ) : null}
                </p>
                {editable ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditBody(note.body);
                      }}
                      className="text-xs font-semibold text-gray-600 hover:text-black"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(note.id)}
                      className="text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
              {editingId === note.id ? (
                <div className="mt-2">
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={editBody}
                    onChange={(event) => setEditBody(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !editBody.trim()}
                      onClick={() => void saveEdit(note.id)}
                      className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-gray-800">
                  {note.body}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update task notes.";
}
